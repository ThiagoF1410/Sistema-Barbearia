const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const { getStripe, idPaymentIntentDaSessao } = require('../services/stripeService')
const { solicitarNotificacaoWhatsapp } = require('../services/disparoNotificacaoWhatsappService')
const { statusDoEvento } = require('../utils/stripeWebhookUtils')

async function webhookStripe(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET não está configurado.')
    return res.status(503).json({ message: 'Webhook não configurado.' })
  }

  let evento
  try {
    const stripe = getStripe()
    evento = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      webhookSecret
    )
  } catch (err) {
    registrarErro('Assinatura inválida no webhook Stripe:', err)
    return res.status(400).json({ message: 'Assinatura do webhook inválida.' })
  }

  const tiposAceitos = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ])
  if (!tiposAceitos.has(evento.type)) return res.status(200).json({ recebido: true })

  const sessao = evento.data.object
  const agendamentoId = sessao.metadata?.agendamento_id
  const pedidoId = sessao.metadata?.pedido_id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Serializa entregas repetidas do mesmo evento antes de consultar a tabela
    // de idempotência. O registro só é inserido depois de atualizar o pagamento.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)',
      [evento.id]
    )
    const jaProcessado = await client.query(
      'SELECT 1 FROM public.stripe_evento WHERE stripe_evento_id = $1',
      [evento.id]
    )
    if (jaProcessado.rows.length) {
      await client.query('ROLLBACK')
      if (statusDoEvento(evento, sessao) === 'CONFIRMADO') {
        solicitarNotificacaoWhatsapp(agendamentoId)
      }
      return res.status(200).json({ recebido: true, duplicado: true })
    }

    if (!idValido(agendamentoId) && !idValido(pedidoId)) {
      await client.query('ROLLBACK')
      console.warn(`Evento Stripe ${evento.id} ignorado: sessão sem agendamento válido.`)
      return res.status(200).json({ recebido: true, ignorado: true })
    }

    const statusPagamento = statusDoEvento(evento, sessao)
    const atualizado = await client.query(
      `UPDATE public.pagamento
       SET statuspagamento = CASE
             WHEN $1::text = 'CONFIRMADO' THEN 'CONFIRMADO'
             WHEN statuspagamento = 'CONFIRMADO' THEN 'CONFIRMADO'
             WHEN $1::text IS NULL THEN statuspagamento
             WHEN statuspagamento = 'CANCELADO' THEN 'CANCELADO'
             ELSE $1::text
           END,
            stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
            atualizado_em = NOW()
       WHERE stripe_checkout_session_id = $3
       RETURNING idpagamento, agendamento_idagendamento, pedido_idpedido`,
      [statusPagamento, idPaymentIntentDaSessao(sessao), sessao.id]
    )

    if (!atualizado.rows.length) {
      const err = new Error(`Pagamento da sessão Stripe ${sessao.id} ainda não foi registrado.`)
      err.code = 'PAGAMENTO_STRIPE_NAO_ENCONTRADO'
      throw err
    }

    const pagamentoAtualizado = atualizado.rows[0]
    if (pagamentoAtualizado.agendamento_idagendamento && statusPagamento === 'CONFIRMADO') {
      await client.query(
        `UPDATE public.whatsapp_notificacao
         SET status = 'ENVIADO', message_id = 'IGNORADA_POR_CONFIRMACAO', atualizado_em = NOW()
         WHERE agendamento_idagendamento = $1
           AND tipo IN ('RESERVA_PAGAMENTO', 'LEMBRETE_PAGAMENTO')
           AND status IN ('PENDENTE', 'FALHOU')`,
        [pagamentoAtualizado.agendamento_idagendamento]
      )
    }
    if (pagamentoAtualizado.agendamento_idagendamento && statusPagamento === 'CANCELADO') {
      await client.query(
        `UPDATE public.agendamento SET statusagendamento = 'CANCELADO'
         WHERE idagendamento = $1 AND statusagendamento = 'AGENDADO'`,
        [pagamentoAtualizado.agendamento_idagendamento]
      )
      await client.query(
        `INSERT INTO public.whatsapp_notificacao
          (agendamento_idagendamento, tipo, proxima_tentativa_em)
         VALUES ($1, 'PAGAMENTO_EXPIRADO', NOW())
         ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
        [pagamentoAtualizado.agendamento_idagendamento]
      )
    }
    if (pagamentoAtualizado.pedido_idpedido) {
      await client.query(
        `UPDATE public.pedido
         SET status = CASE
               WHEN $1::text = 'CONFIRMADO' THEN 'CONFIRMADO'
               WHEN status = 'CONFIRMADO' THEN 'CONFIRMADO'
               WHEN $1::text IS NULL THEN status
               ELSE $1::text
             END,
             atualizado_em = NOW()
         WHERE idpedido = $2`,
        [statusPagamento, pagamentoAtualizado.pedido_idpedido]
      )
    }

    await client.query(
      `INSERT INTO public.stripe_evento (stripe_evento_id, tipo)
       VALUES ($1, $2)`,
      [evento.id, evento.type]
    )

    await client.query('COMMIT')
    if (statusPagamento === 'CONFIRMADO') {
      solicitarNotificacaoWhatsapp(pagamentoAtualizado.agendamento_idagendamento, pagamentoAtualizado.pedido_idpedido)
    }
    return res.status(200).json({ recebido: true })
  } catch (err) {
    await client.query('ROLLBACK')
    registrarErro('Erro ao processar webhook Stripe:', err)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  } finally {
    client.release()
  }
}

module.exports = { webhookStripe }

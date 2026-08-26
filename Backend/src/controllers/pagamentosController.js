const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const {
  getStripe,
  idPaymentIntentDaSessao,
  recuperarSessaoCheckout,
} = require('../services/stripeService')
const {
  obterProcessadorNotificacoesWhatsapp,
} = require('../services/notificacoesWhatsappService')

function solicitarNotificacaoWhatsapp(agendamentoId) {
  if (!idValido(agendamentoId)) return
  setImmediate(() => {
    obterProcessadorNotificacoesWhatsapp()
      .processarAgendamento(agendamentoId)
      .catch((err) => console.warn('Falha ao iniciar notificação do WhatsApp:', {
        codigo: err.code || 'WHATSAPP_NOTIFICATION_ERROR',
      }))
  })
}

function urlFrontend() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
}

function statusDoEvento(evento, sessao) {
  if (
    evento.type === 'checkout.session.async_payment_succeeded'
    || (evento.type === 'checkout.session.completed' && sessao.payment_status === 'paid')
  ) {
    return 'CONFIRMADO'
  }
  if (evento.type === 'checkout.session.async_payment_failed') return 'FALHOU'
  if (evento.type === 'checkout.session.expired') return 'CANCELADO'
  return null
}

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
    console.error('Assinatura inválida no webhook Stripe:', err.message)
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

    if (!idValido(agendamentoId)) {
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
         AND agendamento_idagendamento = $4
       RETURNING idpagamento`,
      [statusPagamento, idPaymentIntentDaSessao(sessao), sessao.id, agendamentoId]
    )

    if (!atualizado.rows.length) {
      const err = new Error(`Pagamento da sessão Stripe ${sessao.id} ainda não foi registrado.`)
      err.code = 'PAGAMENTO_STRIPE_NAO_ENCONTRADO'
      throw err
    }

    await client.query(
      `INSERT INTO public.stripe_evento (stripe_evento_id, tipo)
       VALUES ($1, $2)`,
      [evento.id, evento.type]
    )

    await client.query('COMMIT')
    if (statusPagamento === 'CONFIRMADO') solicitarNotificacaoWhatsapp(agendamentoId)
    return res.status(200).json({ recebido: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao processar webhook Stripe:', err)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  } finally {
    client.release()
  }
}

async function criarCheckout(req, res) {
  const { agendamentoId } = req.body || {}
  if (!idValido(agendamentoId)) {
    return res.status(400).json({ message: 'Informe um agendamento válido.' })
  }

  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true

    // Uma única requisição por agendamento pode consultar/criar checkout por vez.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('checkout_pagamento'), $1::integer)",
      [agendamentoId]
    )

    const agendamentoResult = await client.query(
      `SELECT a.idagendamento, uc.idusuario AS cliente_usuario_id,
              uc.email AS cliente_email, up.nome AS profissional,
              a.servico_nome_snapshot AS servico, a.valor_snapshot AS preco,
              TO_CHAR(a.dataagendamento, 'DD/MM/YYYY') AS data,
              TO_CHAR(a.horario, 'HH24:MI') AS horario,
              a.statusagendamento,
              (a.dataagendamento + a.horario)
                > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS futuro
       FROM public.agendamento a
       JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
       JOIN public.usuario uc ON uc.idusuario = c.usuario_idusuario
       JOIN public.profissional p ON p.idprofissional = a.profissional_idprofissional
       JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
       JOIN public.servico s ON s.idservico = a.servico_idservico
       WHERE a.idagendamento = $1 AND uc.idusuario = $2
       FOR UPDATE OF a`,
      [agendamentoId, req.userId]
    )

    if (!agendamentoResult.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Agendamento não encontrado.' })
    }

    const agendamento = agendamentoResult.rows[0]
    if (agendamento.statusagendamento !== 'AGENDADO') {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Somente agendamentos ativos podem ser pagos.' })
    }
    if (!agendamento.futuro) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Não é possível iniciar pagamento para um horário que já passou.' })
    }

    const valorCentavos = Math.round(Number(agendamento.preco) * 100)
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos < 50) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(400).json({ message: 'O serviço precisa ter valor mínimo de R$ 0,50 para pagamento online.' })
    }

    const pagamentoAtual = await client.query(
      `SELECT idpagamento, stripe_checkout_session_id, statuspagamento
       FROM public.pagamento
       WHERE agendamento_idagendamento = $1
       FOR UPDATE`,
      [agendamentoId]
    )

    if (['CONFIRMADO', 'PAGO'].includes(pagamentoAtual.rows[0]?.statuspagamento)) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      solicitarNotificacaoWhatsapp(agendamentoId)
      return res.status(409).json({ message: 'Este agendamento já está pago.' })
    }

    const stripe = getStripe()
    const sessaoExistente = pagamentoAtual.rows[0]?.stripe_checkout_session_id
    if (sessaoExistente) {
      const sessao = await recuperarSessaoCheckout(stripe, sessaoExistente)
      if (sessao?.payment_status === 'paid') {
        await client.query(
          `UPDATE public.pagamento
           SET statuspagamento = 'CONFIRMADO',
               stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
               atualizado_em = NOW()
           WHERE agendamento_idagendamento = $1`,
          [agendamentoId, idPaymentIntentDaSessao(sessao)]
        )
        await client.query('COMMIT')
        transacaoAtiva = false
        solicitarNotificacaoWhatsapp(agendamentoId)
        return res.status(409).json({ message: 'Este agendamento já está pago.' })
      }
      if (sessao?.status === 'open' && sessao.url) {
        await client.query('COMMIT')
        transacaoAtiva = false
        return res.status(200).json({ checkoutUrl: sessao.url, sessionId: sessao.id, reutilizada: true })
      }
      if (
        sessao?.status === 'complete'
        && pagamentoAtual.rows[0]?.statuspagamento !== 'FALHOU'
      ) {
        await client.query('COMMIT')
        transacaoAtiva = false
        return res.status(409).json({ message: 'O pagamento deste agendamento está em processamento.' })
      }
    }

    const frontend = urlFrontend()
    const chaveIdempotencia = `checkout-agendamento-${agendamento.idagendamento}-${sessaoExistente || 'inicial'}`
    const sessao = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: String(agendamento.idagendamento),
        customer_email: agendamento.cliente_email,
        success_url: `${frontend}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontend}/checkout/cancelado?agendamento=${agendamento.idagendamento}`,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: valorCentavos,
            product_data: {
              name: agendamento.servico,
              description: `${agendamento.data} às ${agendamento.horario} com ${agendamento.profissional}`,
            },
          },
        }],
        metadata: {
          agendamento_id: String(agendamento.idagendamento),
          usuario_id: String(req.userId),
        },
      },
      { idempotencyKey: chaveIdempotencia }
    )

    if (!sessao.url) throw new Error('A Stripe criou uma sessão sem URL de checkout.')

    const pagamentoSalvo = await client.query(
      `INSERT INTO public.pagamento
        (agendamento_idagendamento, datapagamento, valor, statuspagamento, metodo,
         moeda, stripe_checkout_session_id, atualizado_em)
       VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
               $2, 'PENDENTE', 'STRIPE', 'brl', $3, NOW())
       ON CONFLICT (agendamento_idagendamento) DO UPDATE SET
         valor = EXCLUDED.valor,
         statuspagamento = 'PENDENTE',
          metodo = 'STRIPE',
          moeda = EXCLUDED.moeda,
          stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
          atualizado_em = NOW()
        WHERE pagamento.statuspagamento NOT IN ('CONFIRMADO', 'PAGO')
        RETURNING idpagamento`,
      [agendamento.idagendamento, Number(agendamento.preco), sessao.id]
    )

    if (!pagamentoSalvo.rows.length) {
      throw new Error('O pagamento foi confirmado durante a criação do checkout.')
    }

    await client.query('COMMIT')
    transacaoAtiva = false
    return res.status(201).json({ checkoutUrl: sessao.url, sessionId: sessao.id, reutilizada: false })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
    }
    console.error('Erro ao criar checkout Stripe:', err)
    return res.status(502).json({ message: 'Não foi possível iniciar o pagamento agora.' })
  } finally {
    client.release()
  }
}

async function consultarCheckout(req, res) {
  const { sessionId } = req.params
  if (typeof sessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ message: 'Sessão de pagamento inválida.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pagamentoResult = await client.query(
      `SELECT p.idpagamento, p.agendamento_idagendamento, p.statuspagamento
       FROM public.pagamento p
       JOIN public.agendamento a ON a.idagendamento = p.agendamento_idagendamento
       JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
       WHERE p.stripe_checkout_session_id = $1
         AND c.usuario_idusuario = $2
       FOR UPDATE OF p`,
      [sessionId, req.userId]
    )
    if (!pagamentoResult.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Pagamento não encontrado.' })
    }

    const pagamento = pagamentoResult.rows[0]
    let status = pagamento.statuspagamento
    if (status !== 'CONFIRMADO') {
      const stripe = getStripe()
      const sessao = await recuperarSessaoCheckout(stripe, sessionId)
      if (!sessao) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Sessão não encontrada na Stripe.' })
      }

      if (sessao.payment_status === 'paid') status = 'CONFIRMADO'
      else if (!['CANCELADO', 'FALHOU'].includes(status)) {
        status = sessao.status === 'expired' ? 'CANCELADO' : 'PENDENTE'
      }

      await client.query(
        `UPDATE public.pagamento
         SET statuspagamento = $1,
             stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
             atualizado_em = NOW()
         WHERE idpagamento = $3`,
        [status, idPaymentIntentDaSessao(sessao), pagamento.idpagamento]
      )
    }

    await client.query('COMMIT')
    if (status === 'CONFIRMADO') {
      solicitarNotificacaoWhatsapp(pagamento.agendamento_idagendamento)
    }
    return res.status(200).json({
      sessionId,
      agendamentoId: pagamento.agendamento_idagendamento,
      statuspagamento: status,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
    }
    console.error('Erro ao consultar checkout Stripe:', err)
    return res.status(502).json({ message: 'Não foi possível consultar o pagamento agora.' })
  } finally {
    client.release()
  }
}

module.exports = { criarCheckout, consultarCheckout, webhookStripe }

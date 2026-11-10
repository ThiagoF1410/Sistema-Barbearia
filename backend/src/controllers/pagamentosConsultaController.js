const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { getStripe, idPaymentIntentDaSessao, recuperarSessaoCheckout } = require('../services/stripeService')
const { solicitarNotificacaoWhatsapp } = require('../services/disparoNotificacaoWhatsappService')

async function consultarCheckout(req, res) {
  const { sessionId } = req.params
  if (typeof sessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ message: 'Sessão de pagamento inválida.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pagamentoResult = await client.query(
      `SELECT p.idpagamento, p.agendamento_idagendamento, p.pedido_idpedido, p.statuspagamento
       FROM public.pagamento p
       LEFT JOIN public.agendamento a ON a.idagendamento = p.agendamento_idagendamento
       LEFT JOIN public.pedido pe ON pe.idpedido = p.pedido_idpedido
       JOIN public.cliente c ON c.idcliente = COALESCE(a.cliente_idcliente, pe.cliente_idcliente)
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
      if (pagamento.pedido_idpedido) {
        await client.query(
          'UPDATE public.pedido SET status = $1, atualizado_em = NOW() WHERE idpedido = $2',
          [status, pagamento.pedido_idpedido]
        )
      }
    }

    await client.query('COMMIT')
    if (status === 'CONFIRMADO') {
      solicitarNotificacaoWhatsapp(pagamento.agendamento_idagendamento)
    }
    return res.status(200).json({
      sessionId,
      agendamentoId: pagamento.agendamento_idagendamento,
      pedidoId: pagamento.pedido_idpedido,
      statuspagamento: status,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
    }
    registrarErro('Erro ao consultar checkout Stripe:', err)
    return res.status(502).json({ message: 'Não foi possível consultar o pagamento agora.' })
  } finally {
    client.release()
  }
}

module.exports = { consultarCheckout }

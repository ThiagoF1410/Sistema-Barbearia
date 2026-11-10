const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const { getStripe, idPaymentIntentDaSessao, recuperarSessaoCheckout } = require('../services/stripeService')
const { pedidoPermiteCancelamento } = require('../services/pedidosService')

async function cancelarPedido(req, res) {
  const pedidoId = Number(req.params.id)
  if (!idValido(pedidoId)) return res.status(400).json({ message: 'Pedido inválido.' })

  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true
    const pedidoResult = await client.query(
      `SELECT pe.idpedido, pe.status
       FROM public.pedido pe
       JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
       WHERE pe.idpedido = $1
         AND c.usuario_idusuario = $2
         AND pe.tipo = 'AVULSO'
       FOR UPDATE OF pe`,
      [pedidoId, req.userId]
    )

    if (!pedidoResult.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Pedido não encontrado.' })
    }

    const pedido = pedidoResult.rows[0]
    if (pedido.status === 'CANCELADO') {
      await client.query('COMMIT')
      transacaoAtiva = false
      return res.status(200).json({ message: 'Este pedido já está cancelado.', pedidoId, status: 'CANCELADO' })
    }
    if (!pedidoPermiteCancelamento(pedido.status)) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({
        message: 'Este pedido já foi pago e não pode ser cancelado por esta tela. Entre em contato com a barbearia.',
      })
    }

    const pagamentoResult = await client.query(
      `SELECT idpagamento, stripe_checkout_session_id, statuspagamento
       FROM public.pagamento
       WHERE pedido_idpedido = $1
       ORDER BY idpagamento DESC
       LIMIT 1
       FOR UPDATE`,
      [pedidoId]
    )
    const pagamento = pagamentoResult.rows[0]

    if (pagamento?.statuspagamento === 'CONFIRMADO') {
      await client.query(
        "UPDATE public.pedido SET status = 'CONFIRMADO', atualizado_em = NOW() WHERE idpedido = $1",
        [pedidoId]
      )
      await client.query('COMMIT')
      transacaoAtiva = false
      return res.status(409).json({
        message: 'O pagamento deste pedido já foi confirmado. Entre em contato com a barbearia para solicitar atendimento.',
      })
    }

    if (pagamento?.stripe_checkout_session_id) {
      const stripe = getStripe()
      const sessao = await recuperarSessaoCheckout(stripe, pagamento.stripe_checkout_session_id)
      if (sessao?.payment_status === 'paid') {
        await client.query(
          `UPDATE public.pagamento
           SET statuspagamento = 'CONFIRMADO',
               stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
               atualizado_em = NOW()
           WHERE idpagamento = $1`,
          [pagamento.idpagamento, idPaymentIntentDaSessao(sessao)]
        )
        await client.query(
          "UPDATE public.pedido SET status = 'CONFIRMADO', atualizado_em = NOW() WHERE idpedido = $1",
          [pedidoId]
        )
        await client.query('COMMIT')
        transacaoAtiva = false
        return res.status(409).json({
          message: 'O pagamento deste pedido já foi confirmado e ele não pode mais ser cancelado.',
        })
      }
      if (sessao?.status === 'complete' && pagamento.statuspagamento !== 'FALHOU') {
        await client.query('ROLLBACK')
        transacaoAtiva = false
        return res.status(409).json({ message: 'O pagamento está em processamento. Aguarde a atualização antes de cancelar.' })
      }
      if (sessao?.status === 'open') await stripe.checkout.sessions.expire(sessao.id)
    }

    await client.query(
      "UPDATE public.pedido SET status = 'CANCELADO', atualizado_em = NOW() WHERE idpedido = $1",
      [pedidoId]
    )
    if (pagamento) {
      await client.query(
        `UPDATE public.pagamento
         SET statuspagamento = 'CANCELADO', atualizado_em = NOW()
         WHERE idpagamento = $1
           AND statuspagamento IN ('PENDENTE', 'FALHOU', 'CANCELADO')`,
        [pagamento.idpagamento]
      )
    }
    await client.query('COMMIT')
    transacaoAtiva = false
    return res.status(200).json({ message: 'Pedido cancelado com sucesso.', pedidoId, status: 'CANCELADO' })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Não foi possível cancelar a sessão de pagamento agora. Tente novamente.' })
    }
    registrarErro('Erro ao cancelar pedido:', err)
    return res.status(500).json({ message: 'Não foi possível cancelar o pedido agora.' })
  } finally {
    client.release()
  }
}

module.exports = { cancelarPedido }

const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const { getStripe, recuperarSessaoCheckout } = require('../services/stripeService')
const { carregarProdutos, lineItemsStripe, obterCliente, pedidoPermiteNovoPagamento, substituirItens, totalProdutos } = require('../services/pedidosService')
const { urlFrontend } = require('../utils/frontendUrlUtils')

const PRAZO_PAGAMENTO_MS = 10 * 60 * 1000

function erroCheckout(res, err) {
  if (['ITENS_INVALIDOS', 'SACOLA_VAZIA'].includes(err.code)) {
    return res.status(400).json({ message: err.message })
  }
  if (err.code === 'PRODUTO_INDISPONIVEL') return res.status(409).json({ message: err.message })
  if (err.code === 'STRIPE_NOT_CONFIGURED') {
    return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
  }
  registrarErro('Erro ao criar checkout de produtos:', err)
  return res.status(502).json({ message: 'Não foi possível iniciar a compra agora.' })
}

async function criarSessaoPedido(client, pedido, email, frontend) {
  const itensResult = await client.query(
    `SELECT nome_snapshot AS nome, preco_snapshot AS preco, quantidade,
            subtotal, produto_idservico AS idservico
     FROM public.pedido_item WHERE pedido_idpedido = $1 ORDER BY idpedidoitem`,
    [pedido.idpedido]
  )
  const produtos = itensResult.rows.map((item) => ({ ...item, preco: Number(item.preco), quantidade: Number(item.quantidade) }))
  const stripe = getStripe()
  const sessao = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: `pedido-${pedido.idpedido}`,
    customer_email: email,
    success_url: `${frontend}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontend}/checkout/cancelado?pedido=${pedido.idpedido}`,
    line_items: lineItemsStripe(produtos),
    metadata: {
      pedido_id: String(pedido.idpedido),
      usuario_id: String(pedido.usuario_id),
      contexto: 'pedido_avulso',
    },
  }, { idempotencyKey: `checkout-pedido-${pedido.idpedido}-${pedido.tentativa || 'inicial'}` })
  if (!sessao.url) throw new Error('A Stripe criou uma sessão sem URL de checkout.')
  return sessao
}

async function criarCheckoutProdutos(req, res) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cliente = await obterCliente(client, req.userId)
    if (!cliente) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Cadastro de cliente não encontrado.' })
    }
    const produtos = await carregarProdutos(client, req.body?.itens, true)
    const total = totalProdutos(produtos)
    const pedidoResult = await client.query(
      `INSERT INTO public.pedido (cliente_idcliente, tipo, status, total)
       VALUES ($1, 'AVULSO', 'PENDENTE', $2)
       RETURNING idpedido, total`,
      [cliente.idcliente, total]
    )
    const pedido = { ...pedidoResult.rows[0], usuario_id: req.userId }
    await substituirItens(client, pedido.idpedido, produtos)
    const sessao = await criarSessaoPedido(client, pedido, cliente.email, urlFrontend(req))
    const expiraEm = new Date(Date.now() + PRAZO_PAGAMENTO_MS)
    await client.query(
      `INSERT INTO public.pagamento
        (pedido_idpedido, datapagamento, valor, statuspagamento, metodo, moeda,
         stripe_checkout_session_id, checkout_expira_em, expirado_em, atualizado_em)
       VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
               $2, 'PENDENTE', 'STRIPE', 'brl', $3, $4, NULL, NOW())`,
      [pedido.idpedido, total, sessao.id, expiraEm]
    )
    await client.query('COMMIT')
    return res.status(201).json({
      pedidoId: pedido.idpedido,
      checkoutUrl: sessao.url,
      sessionId: sessao.id,
      expiraEm: expiraEm.toISOString(),
    })
  } catch (err) {
    await client.query('ROLLBACK')
    return erroCheckout(res, err)
  } finally {
    client.release()
  }
}

async function reabrirCheckout(req, res) {
  const pedidoId = Number(req.params.id)
  if (!idValido(pedidoId)) return res.status(400).json({ message: 'Pedido inválido.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT pe.idpedido, pe.total, pe.status, u.email, u.idusuario AS usuario_id,
              p.idpagamento, p.stripe_checkout_session_id, p.metodo, p.checkout_expira_em
       FROM public.pedido pe
       JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
       JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
       JOIN public.pagamento p ON p.pedido_idpedido = pe.idpedido
       WHERE pe.idpedido = $1 AND u.idusuario = $2 AND pe.tipo = 'AVULSO'
       FOR UPDATE OF pe, p`,
      [pedidoId, req.userId]
    )
    if (!result.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Pedido não encontrado.' })
    }
    const pedido = result.rows[0]
    if (pedido.metodo === 'DINHEIRO') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este pedido será pago em dinheiro na retirada e não possui pagamento on-line.' })
    }
    if (!pedido.checkout_expira_em) {
      pedido.checkout_expira_em = new Date(Date.now() + PRAZO_PAGAMENTO_MS)
      await client.query(
        `UPDATE public.pagamento
         SET checkout_expira_em = $2, expirado_em = NULL, atualizado_em = NOW()
         WHERE idpagamento = $1 AND statuspagamento = 'PENDENTE'`,
        [pedido.idpagamento, pedido.checkout_expira_em]
      )
    }
    if (new Date(pedido.checkout_expira_em).getTime() <= Date.now()) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'O prazo deste pagamento expirou. Faça um novo pedido.' })
    }
    if (pedido.status === 'CONFIRMADO') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este pedido já está pago.' })
    }
    if (!pedidoPermiteNovoPagamento(pedido.status)) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: 'Este pedido foi cancelado e não pode mais ser pago. Faça uma nova compra pela loja.',
      })
    }
    const existente = await recuperarSessaoCheckout(getStripe(), pedido.stripe_checkout_session_id)
    if (existente?.payment_status === 'paid') {
      await client.query(
        "UPDATE public.pagamento SET statuspagamento = 'CONFIRMADO', atualizado_em = NOW() WHERE idpagamento = $1",
        [pedido.idpagamento]
      )
      await client.query(
        "UPDATE public.pedido SET status = 'CONFIRMADO', atualizado_em = NOW() WHERE idpedido = $1",
        [pedido.idpedido]
      )
      await client.query('COMMIT')
      return res.status(409).json({ message: 'Este pedido já está pago.' })
    }
    if (existente?.status === 'open' && existente.url) {
      await client.query('COMMIT')
      return res.status(200).json({
        pedidoId,
        checkoutUrl: existente.url,
        sessionId: existente.id,
        expiraEm: pedido.checkout_expira_em,
        reutilizada: true,
      })
    }
    const sessao = await criarSessaoPedido(
      client,
      { ...pedido, tentativa: Date.now() },
      pedido.email,
      urlFrontend(req)
    )
    await client.query(
      `UPDATE public.pagamento
       SET statuspagamento = 'PENDENTE', stripe_checkout_session_id = $1, atualizado_em = NOW()
       WHERE idpagamento = $2`,
      [sessao.id, pedido.idpagamento]
    )
    await client.query("UPDATE public.pedido SET status = 'PENDENTE', atualizado_em = NOW() WHERE idpedido = $1", [pedidoId])
    await client.query('COMMIT')
    return res.status(201).json({
      pedidoId,
      checkoutUrl: sessao.url,
      sessionId: sessao.id,
      expiraEm: pedido.checkout_expira_em,
      reutilizada: false,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    return erroCheckout(res, err)
  } finally {
    client.release()
  }
}

module.exports = { criarCheckoutProdutos, reabrirCheckout }

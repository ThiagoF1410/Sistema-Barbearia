const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const { normalizarPaginacao, montarPaginacao } = require('../utils/paginationUtils')
const { getStripe, idPaymentIntentDaSessao, recuperarSessaoCheckout } = require('../services/stripeService')
const {
  carregarProdutos,
  lineItemsStripe,
  obterCliente,
  pedidoPermiteCancelamento,
  pedidoPermiteNovoPagamento,
  substituirItens,
  totalProdutos,
} = require('../services/pedidosService')

const PRAZO_PAGAMENTO_MS = 10 * 60 * 1000

function origemDesenvolvimentoValida(valor) {
  try {
    const url = new URL(valor)
    const hostPrivado = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
    return url.protocol === 'http:' && hostPrivado ? url.origin : null
  } catch {
    return null
  }
}

function urlFrontend(req) {
  const configurada = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
  const origem = req.body?.origemRetorno || req.get?.('origin')
  if (origem === configurada) return configurada
  if (process.env.NODE_ENV !== 'production') return origemDesenvolvimentoValida(origem) || configurada
  return configurada
}

function erroCheckout(res, err) {
  if (['ITENS_INVALIDOS', 'SACOLA_VAZIA'].includes(err.code)) {
    return res.status(400).json({ message: err.message })
  }
  if (err.code === 'PRODUTO_INDISPONIVEL') return res.status(409).json({ message: err.message })
  if (err.code === 'STRIPE_NOT_CONFIGURED') {
    return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
  }
  console.error('Erro ao criar checkout de produtos:', err)
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

async function criarPedidoDinheiro(req, res) {
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
    const pedido = pedidoResult.rows[0]
    await substituirItens(client, pedido.idpedido, produtos)
    await client.query(
      `INSERT INTO public.pagamento
        (pedido_idpedido, datapagamento, valor, statuspagamento, metodo, moeda, atualizado_em)
       VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
               $2, 'PENDENTE', 'DINHEIRO', 'brl', NOW())`,
      [pedido.idpedido, total]
    )
    await client.query('COMMIT')
    return res.status(201).json({
      pedidoId: pedido.idpedido,
      status: 'PENDENTE',
      metodo: 'DINHEIRO',
      message: 'Pedido registrado. O pagamento deverá ser realizado em dinheiro na retirada.',
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (['ITENS_INVALIDOS', 'SACOLA_VAZIA'].includes(err.code)) {
      return res.status(400).json({ message: err.message })
    }
    if (err.code === 'PRODUTO_INDISPONIVEL') return res.status(409).json({ message: err.message })
    console.error('Erro ao criar pedido com pagamento em dinheiro:', err)
    return res.status(500).json({ message: 'Não foi possível registrar o pedido agora.' })
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
    console.error('Erro ao cancelar pedido:', err)
    return res.status(500).json({ message: 'Não foi possível cancelar o pedido agora.' })
  } finally {
    client.release()
  }
}

async function listarMeusPedidos(req, res) {
  const paginacao = normalizarPaginacao(req.query)
  if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })
  const status = String(req.query.status || '').trim().toUpperCase()
  const statusPermitidos = ['PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU', 'AGUARDANDO']
  if (status && !statusPermitidos.includes(status)) {
    return res.status(400).json({ message: 'Situacao do pedido invalida.' })
  }
  try {
    const valores = [req.userId]
    const filtroStatus = status === 'AGUARDANDO'
      ? "AND pe.status IN ('PENDENTE', 'FALHOU')"
      : status ? 'AND pe.status = $2' : ''
    if (status && status !== 'AGUARDANDO') valores.push(status)
    const limiteSql = paginacao.solicitada
      ? `LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`
      : ''
    const valoresConsulta = paginacao.solicitada
      ? [...valores, paginacao.limite, paginacao.offset]
      : valores
    const result = await pool.query(
      `SELECT pe.idpedido, pe.tipo, pe.status, pe.total,
              TO_CHAR(pe.criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS criado_em,
              (SELECT p.metodo FROM public.pagamento p
               WHERE p.pedido_idpedido = pe.idpedido
               ORDER BY p.idpagamento DESC LIMIT 1) AS metodo,
              (SELECT p.checkout_expira_em FROM public.pagamento p
               WHERE p.pedido_idpedido = pe.idpedido
               ORDER BY p.idpagamento DESC LIMIT 1) AS checkout_expira_em,
              COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
                'nome', pi.nome_snapshot, 'quantidade', pi.quantidade,
                'preco', pi.preco_snapshot, 'subtotal', pi.subtotal
              ) ORDER BY pi.idpedidoitem) FILTER (WHERE pi.idpedidoitem IS NOT NULL), '[]') AS itens
       FROM public.pedido pe
       JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
       LEFT JOIN public.pedido_item pi ON pi.pedido_idpedido = pe.idpedido
       WHERE c.usuario_idusuario = $1
         AND pe.tipo = 'AVULSO'
         ${filtroStatus}
       GROUP BY pe.idpedido
       ORDER BY pe.criado_em DESC
       ${limiteSql}`,
      valoresConsulta
    )
    if (paginacao.solicitada) {
      const [contagem, resumo] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::integer AS total FROM public.pedido pe
           JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
           WHERE c.usuario_idusuario = $1 AND pe.tipo = 'AVULSO' ${filtroStatus}`,
          valores
        ),
        pool.query(
          `SELECT pe.status, COUNT(*)::integer AS total FROM public.pedido pe
           JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
           WHERE c.usuario_idusuario = $1 AND pe.tipo = 'AVULSO'
           GROUP BY pe.status`,
          [req.userId]
        ),
      ])
      const porStatus = Object.fromEntries(resumo.rows.map((item) => [item.status, Number(item.total)]))
      const totalGeral = Object.values(porStatus).reduce((soma, quantidade) => soma + quantidade, 0)
      return res.status(200).json({
        pedidos: result.rows,
        resumo: { total: totalGeral, porStatus },
        paginacao: montarPaginacao(contagem.rows[0]?.total, paginacao.pagina, paginacao.limite),
      })
    }
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar pedidos:', err)
    return res.status(500).json({ message: 'Não foi possível carregar seus pedidos.' })
  }
}

module.exports = { cancelarPedido, criarCheckoutProdutos, criarPedidoDinheiro, listarMeusPedidos, reabrirCheckout }

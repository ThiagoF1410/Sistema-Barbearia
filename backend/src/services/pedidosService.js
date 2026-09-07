const { idValido } = require('../utils/agendaUtils')

function normalizarItens(itens) {
  if (!Array.isArray(itens)) return []
  const agrupados = new Map()
  for (const item of itens) {
    const produtoId = Number(item?.produtoId)
    const quantidade = Number(item?.quantidade)
    if (!idValido(produtoId) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20) {
      const erro = new Error('A sacola possui um produto ou uma quantidade inválida.')
      erro.code = 'ITENS_INVALIDOS'
      throw erro
    }
    agrupados.set(produtoId, (agrupados.get(produtoId) || 0) + quantidade)
    if (agrupados.get(produtoId) > 20) {
      const erro = new Error('A quantidade máxima por produto é 20 unidades.')
      erro.code = 'ITENS_INVALIDOS'
      throw erro
    }
  }
  if (agrupados.size > 30) {
    const erro = new Error('A sacola excede o limite de produtos diferentes.')
    erro.code = 'ITENS_INVALIDOS'
    throw erro
  }
  return [...agrupados].map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
}

async function carregarProdutos(client, itens, obrigatorio = false) {
  const normalizados = normalizarItens(itens)
  if (!normalizados.length) {
    if (obrigatorio) {
      const erro = new Error('Adicione pelo menos um produto à sacola.')
      erro.code = 'SACOLA_VAZIA'
      throw erro
    }
    return []
  }

  const ids = normalizados.map((item) => item.produtoId)
  const result = await client.query(
    `SELECT idservico, nome, preco
     FROM public.servico
     WHERE tipo = 'produto' AND idservico = ANY($1::int[])
     ORDER BY nome
     FOR SHARE`,
    [ids]
  )
  if (result.rows.length !== ids.length) {
    const erro = new Error('Um dos produtos não está mais disponível.')
    erro.code = 'PRODUTO_INDISPONIVEL'
    throw erro
  }

  const porId = new Map(result.rows.map((produto) => [Number(produto.idservico), produto]))
  return normalizados.map((item) => {
    const produto = porId.get(item.produtoId)
    const preco = Number(produto.preco)
    return {
      idservico: item.produtoId,
      nome: produto.nome,
      preco,
      quantidade: item.quantidade,
      subtotal: Number((preco * item.quantidade).toFixed(2)),
    }
  })
}

function totalProdutos(produtos) {
  return Number(produtos.reduce((total, item) => total + item.subtotal, 0).toFixed(2))
}

function pedidoPermiteNovoPagamento(status) {
  return ['PENDENTE', 'FALHOU'].includes(String(status || '').toUpperCase())
}

function pedidoPermiteCancelamento(status) {
  return ['PENDENTE', 'FALHOU'].includes(String(status || '').toUpperCase())
}

async function obterCliente(client, usuarioId) {
  const result = await client.query(
    `SELECT c.idcliente, u.email
     FROM public.cliente c
     JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
     WHERE c.usuario_idusuario = $1`,
    [usuarioId]
  )
  return result.rows[0] || null
}

async function substituirItens(client, pedidoId, produtos) {
  await client.query('DELETE FROM public.pedido_item WHERE pedido_idpedido = $1', [pedidoId])
  for (const produto of produtos) {
    await client.query(
      `INSERT INTO public.pedido_item
        (pedido_idpedido, produto_idservico, nome_snapshot, preco_snapshot, quantidade, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [pedidoId, produto.idservico, produto.nome, produto.preco, produto.quantidade, produto.subtotal]
    )
  }
}

function lineItemsStripe(produtos) {
  return produtos.map((produto) => ({
    quantity: produto.quantidade,
    price_data: {
      currency: 'brl',
      unit_amount: Math.round(produto.preco * 100),
      product_data: { name: produto.nome },
    },
  }))
}

module.exports = {
  carregarProdutos,
  lineItemsStripe,
  obterCliente,
  pedidoPermiteCancelamento,
  pedidoPermiteNovoPagamento,
  substituirItens,
  totalProdutos,
}

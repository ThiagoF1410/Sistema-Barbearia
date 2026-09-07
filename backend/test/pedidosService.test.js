const test = require('node:test')
const assert = require('node:assert/strict')
const { carregarProdutos, pedidoPermiteCancelamento, pedidoPermiteNovoPagamento, totalProdutos } = require('../src/services/pedidosService')

test('permite pagamento somente para pedidos pendentes ou com falha', () => {
  assert.equal(pedidoPermiteNovoPagamento('PENDENTE'), true)
  assert.equal(pedidoPermiteNovoPagamento('FALHOU'), true)
  assert.equal(pedidoPermiteNovoPagamento('CANCELADO'), false)
  assert.equal(pedidoPermiteNovoPagamento('CONFIRMADO'), false)
})

test('permite cancelamento somente para pedidos pendentes ou com falha', () => {
  assert.equal(pedidoPermiteCancelamento('PENDENTE'), true)
  assert.equal(pedidoPermiteCancelamento('FALHOU'), true)
  assert.equal(pedidoPermiteCancelamento('CANCELADO'), false)
  assert.equal(pedidoPermiteCancelamento('CONFIRMADO'), false)
})

test('recalcula produtos com o preço confiável do banco', async () => {
  const client = {
    query: async () => ({
      rows: [
        { idservico: 10, nome: 'Pomada', preco: '35.00' },
        { idservico: 11, nome: 'Óleo', preco: '32.00' },
      ],
    }),
  }
  const produtos = await carregarProdutos(client, [
    { produtoId: 10, quantidade: 2, preco: 0.01 },
    { produtoId: 11, quantidade: 1 },
  ], true)

  assert.equal(totalProdutos(produtos), 102)
  assert.deepEqual(produtos.map((item) => item.subtotal), [70, 32])
})

test('agrupa itens repetidos e limita a quantidade', async () => {
  const client = {
    query: async () => ({ rows: [{ idservico: 10, nome: 'Pomada', preco: '35.00' }] }),
  }
  const produtos = await carregarProdutos(client, [
    { produtoId: 10, quantidade: 2 },
    { produtoId: 10, quantidade: 3 },
  ], true)
  assert.equal(produtos[0].quantidade, 5)

  await assert.rejects(
    carregarProdutos(client, [{ produtoId: 10, quantidade: 21 }], true),
    { code: 'ITENS_INVALIDOS' }
  )
})

test('recusa produto que não existe ou não é do tipo produto', async () => {
  const client = { query: async () => ({ rows: [] }) }
  await assert.rejects(
    carregarProdutos(client, [{ produtoId: 99, quantidade: 1 }], true),
    { code: 'PRODUTO_INDISPONIVEL' }
  )
})

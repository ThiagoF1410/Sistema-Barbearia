const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizarPaginacao, montarPaginacao } = require('../src/utils/paginationUtils')

test('normaliza pagina e limita o tamanho maximo', () => {
  assert.deepEqual(normalizarPaginacao({ pagina: '2', limite: '500' }), {
    solicitada: true, pagina: 2, limite: 50, offset: 50,
  })
})

test('preserva compatibilidade quando a paginacao nao foi solicitada', () => {
  assert.deepEqual(normalizarPaginacao({}), {
    solicitada: false, pagina: 1, limite: 12, offset: 0,
  })
})

test('recusa valores invalidos de paginacao', () => {
  assert.match(normalizarPaginacao({ pagina: '0' }).erro, /página/i)
  assert.match(normalizarPaginacao({ limite: 'abc' }).erro, /limite/i)
})

test('informa navegacao disponivel', () => {
  assert.deepEqual(montarPaginacao(25, 2, 10), {
    pagina: 2, limite: 10, total: 25, totalPaginas: 3,
    temAnterior: true, temProxima: true,
  })
})

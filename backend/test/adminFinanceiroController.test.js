const test = require('node:test')
const assert = require('node:assert/strict')
const {
  anoValido,
  filtrosPagamentos,
  criarAdminFinanceiroController,
} = require('../src/controllers/adminFinanceiroController')

function respostaFake() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) { this.statusCode = codigo; return this },
    json(body) { this.body = body; return this },
  }
}

test('valida ano permitido para o relatório', () => {
  assert.equal(anoValido('2026'), true)
  assert.equal(anoValido('1999'), false)
  assert.equal(anoValido('20x6'), false)
})

test('valida filtros e ordem do período de pagamentos', () => {
  assert.deepEqual(filtrosPagamentos({ status: 'confirmado', inicio: '2026-08-01', fim: '2026-08-31' }), {
    status: 'CONFIRMADO', inicio: '2026-08-01', fim: '2026-08-31',
  })
  assert.equal(filtrosPagamentos({ status: 'pago' }).erro, 'Status de pagamento inválido.')
  assert.equal(filtrosPagamentos({ inicio: '2026-09-01', fim: '2026-08-01' }).erro, 'A data inicial não pode ser posterior à data final.')
})

test('lista pagamentos filtrados e calcula resumo sem confiar no cliente', async () => {
  let consulta
  const db = {
    async query(sql, valores) {
      consulta = { sql, valores }
      return { rows: [
        { idpagamento: 1, statuspagamento: 'CONFIRMADO', valor: '45.00' },
        { idpagamento: 2, statuspagamento: 'PENDENTE', valor: '30.00' },
        { idpagamento: 3, statuspagamento: 'CANCELADO', valor: '25.00' },
      ] }
    },
  }
  const controller = criarAdminFinanceiroController(db)
  const res = respostaFake()
  await controller.listarPagamentos({ query: { status: 'confirmado', inicio: '2026-08-01' } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(consulta.valores, ['CONFIRMADO', '2026-08-01'])
  assert.match(consulta.sql, /p\.statuspagamento = \$1/)
  assert.deepEqual(res.body.resumo, {
    quantidade: 3, confirmados: 1, pendentes: 1, falhos: 0, cancelados: 1, valorConfirmado: 45,
  })
})

test('recusa filtro administrativo inválido sem consultar o banco', async () => {
  const db = { query: async () => assert.fail('não deveria consultar o banco') }
  const controller = criarAdminFinanceiroController(db)
  const res = respostaFake()
  await controller.listarPagamentos({ query: { inicio: '31/08/2026' } }, res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.message, 'Data inicial inválida.')
})

test('gera os totais anuais a partir dos doze meses', async () => {
  const meses = Array.from({ length: 12 }, (_, indice) => ({
    mes: indice + 1,
    total_agendamentos: indice === 0 ? 4 : 0,
    concluidos: indice === 0 ? 3 : 0,
    cancelados: indice === 0 ? 1 : 0,
    pagamentos_confirmados: indice === 0 ? 2 : 0,
    faturamento: indice === 0 ? '75.00' : '0.00',
  }))
  const db = { query: async (_sql, valores) => {
    assert.deepEqual(valores, ['2026-01-01', '2027-01-01'])
    return { rows: meses }
  } }
  const controller = criarAdminFinanceiroController(db)
  const res = respostaFake()
  await controller.relatorioMensal({ query: { ano: '2026' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.meses.length, 12)
  assert.deepEqual(res.body.totais, {
    total_agendamentos: 4, concluidos: 3, cancelados: 1,
    pagamentos_confirmados: 2, faturamento: 75,
  })
})

test('traduz falha do banco sem expor detalhes internos', async () => {
  const db = { query: async () => { throw new Error('segredo do banco') } }
  const controller = criarAdminFinanceiroController(db)
  const res = respostaFake()
  const original = console.error
  console.error = () => {}
  try {
    await controller.relatorioMensal({ query: { ano: '2026' } }, res)
  } finally {
    console.error = original
  }
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { message: 'Erro interno no servidor.' })
})

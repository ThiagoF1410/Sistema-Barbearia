const test = require('node:test')
const assert = require('node:assert/strict')

const pool = require('../src/config/db')
const { concluirAdmin } = require('../src/controllers/agenda/agendamentosAdminController')

function respostaMock() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo
      return this
    },
    json(conteudo) {
      this.body = conteudo
      return this
    },
  }
}

async function executarComConsultas(resultados) {
  const queryOriginal = pool.query
  let indice = 0
  pool.query = async () => resultados[indice++]
  const res = respostaMock()

  try {
    await concluirAdmin({ params: { id: '10' } }, res)
    return { res, consultas: indice }
  } finally {
    pool.query = queryOriginal
  }
}

test('não conclui atendimento antes do horário final e informa quando será liberado', async () => {
  const { res, consultas } = await executarComConsultas([{ rows: [{
    statusagendamento: 'AGENDADO',
    statuspagamento: 'CONFIRMADO',
    terminou: false,
    data_termino: '12/11/2026',
    horario_termino: '16:30',
  }] }])

  assert.equal(res.statusCode, 409)
  assert.equal(res.body.codigo, 'ATENDIMENTO_NAO_FINALIZADO')
  assert.equal(res.body.message, 'Este atendimento ainda não terminou. Ele poderá ser concluído após 12/11/2026 às 16:30.')
  assert.equal(consultas, 1)
})

test('não conclui atendimento terminado enquanto o pagamento estiver pendente', async () => {
  const { res, consultas } = await executarComConsultas([{ rows: [{
    statusagendamento: 'AGENDADO',
    statuspagamento: 'PENDENTE',
    terminou: true,
    data_termino: '12/11/2026',
    horario_termino: '16:30',
  }] }])

  assert.equal(res.statusCode, 409)
  assert.equal(res.body.codigo, 'PAGAMENTO_NAO_CONFIRMADO')
  assert.equal(res.body.message, 'O pagamento deste atendimento ainda está pendente. Confirme o pagamento antes de concluí-lo.')
  assert.equal(consultas, 1)
})

test('conclui atendimento terminado com pagamento confirmado', async () => {
  const { res, consultas } = await executarComConsultas([
    { rows: [{
      statusagendamento: 'AGENDADO',
      statuspagamento: 'CONFIRMADO',
      terminou: true,
      data_termino: '12/11/2026',
      horario_termino: '16:30',
    }] },
    { rows: [{ idagendamento: 10, statusagendamento: 'CONCLUIDO' }] },
  ])

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.message, 'Atendimento concluído.')
  assert.equal(res.body.statusagendamento, 'CONCLUIDO')
  assert.equal(consultas, 2)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  atendimentoCabeNoExpediente,
  dataIsoValida,
  horaParaMinutos,
  idValido,
  minutosParaHora,
} = require('../src/utils/agendaUtils')
const { emailValido, normalizarEmail } = require('../src/utils/authUtils')
const { criarLimitador } = require('../src/middlewares/rateLimitMiddleware')

test('valida datas ISO reais, inclusive ano bissexto', () => {
  assert.equal(dataIsoValida('2028-02-29'), true)
  assert.equal(dataIsoValida('2027-02-29'), false)
  assert.equal(dataIsoValida('2026-13-01'), false)
  assert.equal(dataIsoValida('01/01/2026'), false)
})

test('converte horários entre texto e minutos', () => {
  assert.equal(horaParaMinutos('09:35'), 575)
  assert.equal(minutosParaHora(575), '09:35')
})

test('valida se um atendimento cabe no expediente e fora do intervalo', () => {
  const regra = {
    ativo: true,
    hora_abertura: '09:00',
    hora_fechamento: '19:30',
    intervalo_ativo: true,
    hora_inicio_intervalo: '12:00',
    hora_fim_intervalo: '14:00',
  }

  assert.equal(atendimentoCabeNoExpediente('09:00', 30, regra), true)
  assert.equal(atendimentoCabeNoExpediente('11:45', 30, regra), false)
  assert.equal(atendimentoCabeNoExpediente('13:30', 30, regra), false)
  assert.equal(atendimentoCabeNoExpediente('14:00', 30, regra), true)
  assert.equal(atendimentoCabeNoExpediente('19:15', 30, regra), false)
  assert.equal(atendimentoCabeNoExpediente('09:00', 30, { ...regra, ativo: false }), false)
})

test('valida identificadores positivos', () => {
  assert.equal(idValido('9'), true)
  assert.equal(idValido(1), true)
  assert.equal(idValido(0), false)
  assert.equal(idValido('1 OR 1=1'), false)
})

test('normaliza e valida e-mail', () => {
  assert.equal(normalizarEmail('  Cliente@Exemplo.COM '), 'cliente@exemplo.com')
  assert.equal(emailValido('cliente@exemplo.com'), true)
  assert.equal(emailValido('cliente@'), false)
})

test('limitador retorna 429 depois do limite configurado', () => {
  const middleware = criarLimitador({ janelaMs: 60_000, limite: 2, mensagem: 'Limite atingido.' })
  const req = { ip: '127.0.0.99', baseUrl: '/teste', path: '/login' }
  const respostas = []
  const res = {
    set() {},
    status(codigo) {
      this.codigo = codigo
      return this
    },
    json(corpo) {
      respostas.push({ codigo: this.codigo, corpo })
      return this
    },
  }
  let proximos = 0
  const next = () => { proximos += 1 }

  middleware(req, res, next)
  middleware(req, res, next)
  middleware(req, res, next)

  assert.equal(proximos, 2)
  assert.deepEqual(respostas, [{ codigo: 429, corpo: { message: 'Limite atingido.' } }])
})

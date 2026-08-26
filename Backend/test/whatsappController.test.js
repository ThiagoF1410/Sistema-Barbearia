const test = require('node:test')
const assert = require('node:assert/strict')
const { criarWhatsappController } = require('../src/controllers/whatsappController')
const { WhatsAppError } = require('../src/services/whatsappService')
const { authMiddleware, roleGuard } = require('../src/middlewares/authMiddleware')
const { limitarWhatsAppTeste } = require('../src/middlewares/rateLimitMiddleware')

const loggerSilencioso = { info() {}, warn() {} }

function respostaFake() {
  return {
    statusCode: 200,
    headers: {},
    status(codigo) { this.statusCode = codigo; return this },
    set(nome, valor) { this.headers[nome] = valor; return this },
    json(corpo) { this.body = corpo; return this },
  }
}

function requisicaoFake({ json = true, body = {}, userId = 6 } = {}) {
  return {
    body,
    userId,
    ip: '127.0.0.35',
    baseUrl: '/api/whatsapp',
    path: '/teste',
    headers: {},
    is: (tipo) => json && tipo === 'application/json',
  }
}

test('controller do WhatsApp exige JSON vazio', async () => {
  const controller = criarWhatsappController({
    criarCliente: () => ({ enviarTeste: async () => ({ messageId: 'baileys.ok' }) }),
    logger: loggerSilencioso,
  })

  const semJson = respostaFake()
  await controller.enviarTeste(requisicaoFake({ json: false }), semJson)
  assert.equal(semJson.statusCode, 415)

  const comCampo = respostaFake()
  await controller.enviarTeste(requisicaoFake({ body: { telefone: '11999991234' } }), comCampo)
  assert.equal(comCampo.statusCode, 400)
})

test('controller retorna somente confirmação e messageId no sucesso', async () => {
  const controller = criarWhatsappController({
    criarCliente: () => ({ enviarTeste: async () => ({ messageId: 'baileys.ok123' }) }),
    logger: loggerSilencioso,
  })
  const res = respostaFake()

  await controller.enviarTeste(requisicaoFake(), res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, {
    message: 'Mensagem de teste enviada pelo WhatsApp.',
    messageId: 'baileys.ok123',
  })
})

test('controller informa o estado da conexão sem expor a sessão', () => {
  const controller = criarWhatsappController({
    criarCliente: () => ({ obterStatus: () => ({ estado: 'aguardando_qr', qrPendente: true }) }),
    logger: loggerSilencioso,
  })
  const res = respostaFake()

  controller.consultarStatus(requisicaoFake(), res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { estado: 'aguardando_qr', qrPendente: true })
})

test('controller traduz erros tipados sem devolver detalhes internos', async () => {
  const casos = [
    ['WHATSAPP_NOT_CONFIGURED', 503],
    ['WHATSAPP_INVALID_CONFIG', 503],
    ['WHATSAPP_TEST_DISABLED', 503],
    ['WHATSAPP_NOT_CONNECTED', 503],
    ['WHATSAPP_CONNECTION_ERROR', 503],
    ['WHATSAPP_TIMEOUT', 504],
    ['WHATSAPP_SEND_ERROR', 502],
    ['WHATSAPP_INVALID_RESPONSE', 502],
  ]

  for (const [codigo, status] of casos) {
    const falha = new WhatsAppError(codigo, 'detalhe interno secreto', { disconnectCode: 401 })
    const controller = criarWhatsappController({
      criarCliente: () => ({ enviarTeste: async () => { throw falha } }),
      logger: loggerSilencioso,
    })
    const res = respostaFake()

    await controller.enviarTeste(requisicaoFake(), res)

    assert.equal(res.statusCode, status)
    assert.equal(JSON.stringify(res.body).includes('detalhe interno secreto'), false)
    assert.equal(JSON.stringify(res.body).includes('401'), false)
  }
})

test('middlewares recusam requisição sem token e perfil não administrativo', async () => {
  const semToken = respostaFake()
  await authMiddleware(requisicaoFake(), semToken, () => assert.fail('não deve avançar sem token'))
  assert.equal(semToken.statusCode, 401)

  const perfilCliente = requisicaoFake()
  perfilCliente.userRole = 'cliente'
  const semPermissao = respostaFake()
  roleGuard('admin')(perfilCliente, semPermissao, () => assert.fail('cliente não deve avançar'))
  assert.equal(semPermissao.statusCode, 403)

  const perfilAdmin = requisicaoFake()
  perfilAdmin.userRole = 'admin'
  let avancou = false
  roleGuard('admin')(perfilAdmin, respostaFake(), () => { avancou = true })
  assert.equal(avancou, true)
})

test('limitador específico bloqueia a sexta tentativa do mesmo administrador e IP', () => {
  const req = requisicaoFake({ userId: 35001 })
  const res = respostaFake()
  let avancou = 0

  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    limitarWhatsAppTeste(req, res, () => { avancou += 1 })
  }

  assert.equal(avancou, 5)
  assert.equal(res.statusCode, 429)
  assert.ok(Number(res.headers['Retry-After']) > 0)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  criarClienteWhatsApp,
  normalizarTelefoneBrasil,
  validarTexto,
} = require('../src/services/whatsappService')

function ambienteWhatsapp(sobrescrever = {}) {
  return {
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_TIMEOUT_MS: '5000',
    WHATSAPP_RECONNECT_MS: '5000',
    ...sobrescrever,
  }
}

function dependenciasFake({ resultadoEnvio = { key: { id: 'BAILEYS-123' } }, falhaEnvio } = {}) {
  const handlers = {}
  const chamadas = []
  const qrs = []
  let salvamentos = 0
  const socket = {
    ev: { on: (evento, handler) => { handlers[evento] = handler } },
    async sendMessage(jid, conteudo) {
      chamadas.push({ jid, conteudo })
      if (falhaEnvio) throw falhaEnvio
      return resultadoEnvio
    },
    end() {},
  }

  return {
    handlers,
    chamadas,
    qrs,
    socket,
    get salvamentos() { return salvamentos },
    async carregarDependencias() {
      return {
        makeWASocket: () => socket,
        useMultiFileAuthState: async () => ({
          state: { creds: {}, keys: {} },
          saveCreds: async () => { salvamentos += 1 },
        }),
        DisconnectReason: { loggedOut: 401 },
        Browsers: { ubuntu: (nome) => [nome, 'Chrome', '1.0.0'] },
        renderizarQr: (qr) => qrs.push(qr),
      }
    },
  }
}

const loggerSilencioso = { info() {}, warn() {} }

async function clienteConectado(opcoes = {}) {
  const fake = dependenciasFake(opcoes)
  const cliente = criarClienteWhatsApp({
    env: ambienteWhatsapp(),
    carregarDependencias: fake.carregarDependencias,
    sessionDirectory: '.sessao-teste',
    logger: loggerSilencioso,
  })
  await cliente.iniciar()
  fake.handlers['connection.update']({ connection: 'open' })
  return { cliente, fake }
}

test('normaliza telefone brasileiro para o formato internacional', () => {
  assert.equal(normalizarTelefoneBrasil('(11) 99999-1234'), '5511999991234')
  assert.equal(normalizarTelefoneBrasil('(11) 3456-7890'), '551134567890')
  assert.equal(normalizarTelefoneBrasil('+55 11 99999-1234'), '5511999991234')
  assert.throws(() => normalizarTelefoneBrasil('telefone 11999991234'), { code: 'WHATSAPP_INVALID_PHONE' })
  assert.throws(() => normalizarTelefoneBrasil('00999991234'), { code: 'WHATSAPP_INVALID_PHONE' })
})

test('valida mensagem antes do envio', () => {
  assert.equal(validarTexto('  Confirmação  '), 'Confirmação')
  assert.throws(() => validarTexto(''), { code: 'WHATSAPP_INVALID_MESSAGE' })
  assert.throws(() => validarTexto('x'.repeat(4097)), { code: 'WHATSAPP_INVALID_MESSAGE' })
})

test('exibe QR Code, salva credenciais e registra conexão', async () => {
  const fake = dependenciasFake()
  const cliente = criarClienteWhatsApp({
    env: ambienteWhatsapp(),
    carregarDependencias: fake.carregarDependencias,
    sessionDirectory: '.sessao-teste',
    logger: loggerSilencioso,
  })

  await cliente.iniciar()
  assert.deepEqual(cliente.obterStatus(), { estado: 'conectando', qrPendente: false })
  fake.handlers['connection.update']({ qr: 'qr-de-teste' })
  assert.deepEqual(cliente.obterStatus(), { estado: 'aguardando_qr', qrPendente: true })
  assert.deepEqual(fake.qrs, ['qr-de-teste'])
  await fake.handlers['creds.update']()
  assert.equal(fake.salvamentos, 1)
  fake.handlers['connection.update']({ connection: 'open' })
  assert.deepEqual(cliente.obterStatus(), { estado: 'conectado', qrPendente: false })
  await cliente.encerrar()
})

test('envia texto pelo socket conectado para o JID individual', async () => {
  const { cliente, fake } = await clienteConectado()
  const resultado = await cliente.enviarTexto({
    telefone: '11999991234',
    mensagem: 'Confirmação de teste',
  })

  assert.deepEqual(resultado, { messageId: 'BAILEYS-123' })
  assert.deepEqual(fake.chamadas, [{
    jid: '5511999991234@s.whatsapp.net',
    conteudo: { text: 'Confirmação de teste' },
  }])
  await cliente.encerrar()
})

test('endpoint interno usa destinatário e mensagem definidos no ambiente', async () => {
  const fake = dependenciasFake()
  const cliente = criarClienteWhatsApp({
    env: ambienteWhatsapp({
      WHATSAPP_TEST_ENDPOINT_ENABLED: 'true',
      WHATSAPP_TEST_RECIPIENT: '5511988887777',
      WHATSAPP_TEST_MESSAGE: 'Teste do TCC',
    }),
    carregarDependencias: fake.carregarDependencias,
    logger: loggerSilencioso,
  })
  await cliente.iniciar()
  fake.handlers['connection.update']({ connection: 'open' })

  assert.deepEqual(await cliente.enviarTeste(), { messageId: 'BAILEYS-123' })
  assert.deepEqual(fake.chamadas[0], {
    jid: '5511988887777@s.whatsapp.net',
    conteudo: { text: 'Teste do TCC' },
  })
  await cliente.encerrar()
})

test('recusa envio quando desativado ou ainda desconectado', async () => {
  const desativado = criarClienteWhatsApp({ env: { WHATSAPP_ENABLED: 'false' } })
  await assert.rejects(
    desativado.enviarTexto({ telefone: '11999991234', mensagem: 'Teste' }),
    { code: 'WHATSAPP_NOT_CONFIGURED' }
  )

  const desconectado = criarClienteWhatsApp({ env: ambienteWhatsapp() })
  await assert.rejects(
    desconectado.enviarTexto({ telefone: '11999991234', mensagem: 'Teste' }),
    { code: 'WHATSAPP_NOT_CONNECTED' }
  )
})

test('converte falha de envio e resposta sem ID em erros tipados', async () => {
  const falha = await clienteConectado({ falhaEnvio: new Error('detalhe interno') })
  await assert.rejects(
    falha.cliente.enviarTexto({ telefone: '11999991234', mensagem: 'Teste' }),
    { code: 'WHATSAPP_SEND_ERROR' }
  )
  await falha.cliente.encerrar()

  const semId = await clienteConectado({ resultadoEnvio: { key: {} } })
  await assert.rejects(
    semId.cliente.enviarTexto({ telefone: '11999991234', mensagem: 'Teste' }),
    { code: 'WHATSAPP_INVALID_RESPONSE' }
  )
  await semId.cliente.encerrar()
})

test('não tenta reconectar automaticamente depois de logout', async () => {
  const fake = dependenciasFake()
  const cliente = criarClienteWhatsApp({
    env: ambienteWhatsapp(),
    carregarDependencias: fake.carregarDependencias,
    logger: loggerSilencioso,
  })
  await cliente.iniciar()
  fake.handlers['connection.update']({
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 401 } } },
  })
  assert.deepEqual(cliente.obterStatus(), { estado: 'sessao_encerrada', qrPendente: false })
  await cliente.encerrar()
})

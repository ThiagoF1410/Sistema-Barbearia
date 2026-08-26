const path = require('node:path')

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RECONNECT_MS = 5_000
const MAX_TEXT_LENGTH = 4096
const SESSION_DIRECTORY = path.resolve(__dirname, '../../.whatsapp-session')

class WhatsAppError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'WhatsAppError'
    this.code = code
    if (details.disconnectCode !== undefined) this.disconnectCode = details.disconnectCode
  }
}

function erro(code, message, details) {
  return new WhatsAppError(code, message, details)
}

function normalizarTelefoneBrasil(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw erro('WHATSAPP_INVALID_PHONE', 'Telefone do WhatsApp inválido.')
  }

  const telefone = valor.trim()
  if (!/^\+?[\d\s().-]+$/.test(telefone) || (telefone.includes('+') && !telefone.startsWith('+'))) {
    throw erro('WHATSAPP_INVALID_PHONE', 'Telefone do WhatsApp inválido.')
  }

  const digitos = telefone.replace(/\D/g, '')
  const internacional = digitos.startsWith('55') && [12, 13].includes(digitos.length)
    ? digitos
    : [10, 11].includes(digitos.length)
      ? `55${digitos}`
      : null

  if (!internacional || !/^55[1-9]\d\d{8,9}$/.test(internacional)) {
    throw erro('WHATSAPP_INVALID_PHONE', 'Telefone do WhatsApp inválido.')
  }

  return internacional
}

function validarTexto(mensagem) {
  if (typeof mensagem !== 'string') {
    throw erro('WHATSAPP_INVALID_MESSAGE', 'Mensagem do WhatsApp inválida.')
  }

  const texto = mensagem.trim()
  if (!texto || Array.from(texto).length > MAX_TEXT_LENGTH) {
    throw erro('WHATSAPP_INVALID_MESSAGE', 'Mensagem do WhatsApp inválida.')
  }
  return texto
}

function obterConfiguracao(env) {
  if (env.WHATSAPP_ENABLED !== 'true') {
    throw erro('WHATSAPP_NOT_CONFIGURED', 'Integração com WhatsApp desativada.')
  }

  const timeoutMs = Number(env.WHATSAPP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const reconnectMs = Number(env.WHATSAPP_RECONNECT_MS || DEFAULT_RECONNECT_MS)
  if (
    !Number.isInteger(timeoutMs)
    || timeoutMs < 1000
    || timeoutMs > 30_000
    || !Number.isInteger(reconnectMs)
    || reconnectMs < 1000
    || reconnectMs > 60_000
  ) {
    throw erro('WHATSAPP_INVALID_CONFIG', 'Configuração do WhatsApp inválida.')
  }

  return { timeoutMs, reconnectMs }
}

function obterConfiguracaoTeste(env) {
  if (env.WHATSAPP_TEST_ENDPOINT_ENABLED !== 'true') {
    throw erro('WHATSAPP_TEST_DISABLED', 'Endpoint de teste do WhatsApp desativado.')
  }

  const destinatario = env.WHATSAPP_TEST_RECIPIENT?.trim()
  if (!/^55[1-9]\d\d{8,9}$/.test(destinatario || '')) {
    throw erro('WHATSAPP_INVALID_CONFIG', 'Destinatário de teste do WhatsApp inválido.')
  }

  const mensagem = validarTexto(
    env.WHATSAPP_TEST_MESSAGE || 'Teste de confirmação de agendamento — O Rei da Navalha.'
  )
  return { destinatario, mensagem }
}

function criarLoggerSilencioso() {
  const logger = {
    level: 'silent',
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    fatal() {},
    child() { return logger },
  }
  return logger
}

async function carregarDependenciasPadrao() {
  const baileys = await import('@whiskeysockets/baileys')
  const qrcode = require('qrcode-terminal')
  return {
    makeWASocket: baileys.default,
    useMultiFileAuthState: baileys.useMultiFileAuthState,
    DisconnectReason: baileys.DisconnectReason,
    Browsers: baileys.Browsers,
    renderizarQr(qr) {
      console.log('\nWhatsApp Baileys: escaneie o QR Code abaixo em Aparelhos conectados:\n')
      qrcode.generate(qr, { small: true }, (codigo) => console.log(codigo))
    },
  }
}

function criarClienteWhatsApp({
  env = process.env,
  carregarDependencias = carregarDependenciasPadrao,
  sessionDirectory = SESSION_DIRECTORY,
  logger = console,
} = {}) {
  let socket = null
  let estado = env.WHATSAPP_ENABLED === 'true' ? 'desconectado' : 'desativado'
  let qrPendente = false
  let inicializacao = null
  let temporizadorReconexao = null
  let encerrando = false
  let dependencias = null

  function registrarAviso(mensagem, detalhes = {}) {
    logger.warn(mensagem, detalhes)
  }

  function agendarReconexao() {
    if (encerrando || temporizadorReconexao) return
    const { reconnectMs } = obterConfiguracao(env)
    temporizadorReconexao = setTimeout(() => {
      temporizadorReconexao = null
      iniciar().catch((err) => registrarAviso('Falha ao reconectar o WhatsApp:', { codigo: err.code }))
    }, reconnectMs)
    temporizadorReconexao.unref?.()
  }

  async function criarConexao() {
    obterConfiguracao(env)
    dependencias ||= await carregarDependencias()

    if (
      typeof dependencias.makeWASocket !== 'function'
      || typeof dependencias.useMultiFileAuthState !== 'function'
      || typeof dependencias.renderizarQr !== 'function'
    ) {
      throw erro('WHATSAPP_INVALID_CONFIG', 'Dependências do WhatsApp indisponíveis.')
    }

    const { state, saveCreds } = await dependencias.useMultiFileAuthState(sessionDirectory)
    estado = 'conectando'
    qrPendente = false

    const novoSocket = dependencias.makeWASocket({
      auth: state,
      browser: dependencias.Browsers?.ubuntu?.('O Rei da Navalha') || ['O Rei da Navalha', 'Chrome', '1.0.0'],
      logger: criarLoggerSilencioso(),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      defaultQueryTimeoutMs: obterConfiguracao(env).timeoutMs,
    })

    if (!novoSocket?.ev?.on || typeof novoSocket.sendMessage !== 'function') {
      throw erro('WHATSAPP_INVALID_CONFIG', 'Cliente do WhatsApp inválido.')
    }

    socket = novoSocket
    novoSocket.ev.on('creds.update', saveCreds)
    novoSocket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (novoSocket !== socket || encerrando) return

      if (qr) {
        estado = 'aguardando_qr'
        qrPendente = true
        dependencias.renderizarQr(qr)
      }

      if (connection === 'open') {
        estado = 'conectado'
        qrPendente = false
        logger.info('WhatsApp conectado pelo Baileys.')
      }

      if (connection === 'close') {
        const disconnectCode = lastDisconnect?.error?.output?.statusCode
          ?? lastDisconnect?.error?.statusCode
        socket = null
        qrPendente = false

        if (disconnectCode === dependencias.DisconnectReason?.loggedOut) {
          estado = 'sessao_encerrada'
          registrarAviso('A sessão do WhatsApp foi encerrada. Remova a sessão local e conecte novamente.', {
            disconnectCode,
          })
          return
        }

        estado = 'reconectando'
        registrarAviso('Conexão do WhatsApp encerrada; uma reconexão será tentada.', { disconnectCode })
        agendarReconexao()
      }
    })
  }

  async function iniciar() {
    if (socket || inicializacao) return inicializacao
    encerrando = false
    inicializacao = criarConexao()
      .catch((err) => {
        estado = 'erro'
        if (err instanceof WhatsAppError) throw err
        throw erro('WHATSAPP_CONNECTION_ERROR', 'Não foi possível iniciar o WhatsApp.')
      })
      .finally(() => { inicializacao = null })
    return inicializacao
  }

  function obterStatus() {
    return { estado, qrPendente }
  }

  async function enviarTexto({ telefone, mensagem }) {
    obterConfiguracao(env)
    const destinatario = normalizarTelefoneBrasil(telefone)
    const texto = validarTexto(mensagem)
    if (!socket || estado !== 'conectado') {
      throw erro('WHATSAPP_NOT_CONNECTED', 'WhatsApp ainda não está conectado.')
    }

    let timeoutId
    try {
      const timeoutMs = obterConfiguracao(env).timeoutMs
      const resultado = await Promise.race([
        socket.sendMessage(`${destinatario}@s.whatsapp.net`, { text: texto }),
        new Promise((resolve, reject) => {
          timeoutId = setTimeout(
            () => reject(erro('WHATSAPP_TIMEOUT', 'O WhatsApp não respondeu a tempo.')),
            timeoutMs
          )
        }),
      ])
      const messageId = resultado?.key?.id
      if (typeof messageId !== 'string' || !messageId || /[\u0000-\u001f\u007f]/.test(messageId)) {
        throw erro('WHATSAPP_INVALID_RESPONSE', 'Resposta inválida do WhatsApp.')
      }
      return { messageId }
    } catch (err) {
      if (err instanceof WhatsAppError) throw err
      throw erro('WHATSAPP_SEND_ERROR', 'Não foi possível enviar a mensagem pelo WhatsApp.')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async function enviarTeste() {
    const teste = obterConfiguracaoTeste(env)
    return enviarTexto({ telefone: teste.destinatario, mensagem: teste.mensagem })
  }

  async function encerrar() {
    encerrando = true
    clearTimeout(temporizadorReconexao)
    temporizadorReconexao = null
    const socketAtual = socket
    socket = null
    estado = env.WHATSAPP_ENABLED === 'true' ? 'desconectado' : 'desativado'
    qrPendente = false
    if (socketAtual?.end) socketAtual.end(new Error('Servidor encerrado.'))
  }

  return { iniciar, encerrar, enviarTexto, enviarTeste, obterStatus }
}

let clientePadrao
function obterClienteWhatsApp() {
  clientePadrao ||= criarClienteWhatsApp()
  return clientePadrao
}

module.exports = {
  WhatsAppError,
  criarClienteWhatsApp,
  obterClienteWhatsApp,
  normalizarTelefoneBrasil,
  validarTexto,
}

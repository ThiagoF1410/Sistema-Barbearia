const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RECONNECT_MS = 5_000
const MAX_TEXT_LENGTH = 4096

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

function extrairTextoMensagem(conteudo, profundidade = 0) {
  if (!conteudo || typeof conteudo !== 'object' || profundidade > 3) return ''
  if (typeof conteudo.conversation === 'string') return conteudo.conversation.trim()
  if (typeof conteudo.extendedTextMessage?.text === 'string') return conteudo.extendedTextMessage.text.trim()
  if (typeof conteudo.imageMessage?.caption === 'string') return conteudo.imageMessage.caption.trim()
  if (typeof conteudo.videoMessage?.caption === 'string') return conteudo.videoMessage.caption.trim()

  const encapsulada = conteudo.ephemeralMessage?.message
    || conteudo.viewOnceMessage?.message
    || conteudo.viewOnceMessageV2?.message
    || conteudo.documentWithCaptionMessage?.message
  return encapsulada ? extrairTextoMensagem(encapsulada, profundidade + 1) : ''
}

function extrairTelefoneRemetente(chave = {}) {
  const candidatos = [chave.remoteJidAlt, chave.participantAlt, chave.participant, chave.remoteJid]
  for (const jid of candidatos) {
    if (typeof jid !== 'string' || !jid.endsWith('@s.whatsapp.net')) continue
    const numero = jid.split('@')[0].split(':')[0].replace(/\D/g, '')
    if (/^55[1-9]\d\d{8,9}$/.test(numero)) return numero
  }
  return null
}

module.exports = {
  WhatsAppError,
  criarLoggerSilencioso,
  erro,
  extrairTelefoneRemetente,
  extrairTextoMensagem,
  normalizarTelefoneBrasil,
  obterConfiguracao,
  obterConfiguracaoTeste,
  validarTexto,
}


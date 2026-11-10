const path = require('node:path')

const SESSION_DIRECTORY = path.resolve(__dirname, '../../.whatsapp-session')
const {
  WhatsAppError,
  criarLoggerSilencioso,
  erro,
  extrairTelefoneRemetente,
  extrairTextoMensagem,
  normalizarTelefoneBrasil,
  obterConfiguracao,
  obterConfiguracaoTeste,
  validarTexto,
} = require('./whatsappUtils')
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
  sessionDirectory = path.resolve(env.WHATSAPP_SESSION_DIR || SESSION_DIRECTORY),
  logger = console,
} = {}) {
  let socket = null
  let estado = env.WHATSAPP_ENABLED === 'true' ? 'desconectado' : 'desativado'
  let qrPendente = false
  let inicializacao = null
  let temporizadorReconexao = null
  let encerrando = false
  let dependencias = null
  const manipuladoresMensagens = new Set()

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
    novoSocket.ev.on('messages.upsert', (evento = {}) => {
      if (novoSocket !== socket || encerrando || evento.type !== 'notify') return
      for (const item of evento.messages || []) {
        if (item?.key?.fromMe || item?.key?.remoteJid === 'status@broadcast') continue
        const texto = extrairTextoMensagem(item.message)
        const telefone = extrairTelefoneRemetente(item.key)
        const messageId = item?.key?.id
        if (!texto || !telefone || typeof messageId !== 'string' || !messageId) continue

        for (const manipulador of manipuladoresMensagens) {
          Promise.resolve(manipulador({ messageId, telefone, texto }))
            .catch((err) => registrarAviso('Falha ao processar mensagem recebida no WhatsApp:', {
              codigo: err?.code || 'WHATSAPP_INCOMING_MESSAGE_ERROR',
            }))
        }
      }
    })
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

  function obterContato() {
    obterConfiguracao(env)
    const contatoConfigurado = env.WHATSAPP_CONTACT_NUMBER?.trim()
    if (contatoConfigurado) return normalizarTelefoneBrasil(contatoConfigurado)
    if (!socket || estado !== 'conectado') {
      throw erro('WHATSAPP_NOT_CONNECTED', 'WhatsApp ainda não está conectado.')
    }

    const configurado = env.WHATSAPP_CONTACT_NUMBER?.trim()
    if (configurado) return normalizarTelefoneBrasil(configurado)

    const jid = socket.user?.phoneNumber || socket.user?.id
    const numero = typeof jid === 'string' ? jid.split('@')[0].split(':')[0] : ''
    if (!/^55[1-9]\d\d{8,9}$/.test(numero)) {
      throw erro('WHATSAPP_CONTACT_UNAVAILABLE', 'Número de atendimento indisponível.')
    }
    return numero
  }

  function registrarManipuladorMensagens(manipulador) {
    if (typeof manipulador !== 'function') {
      throw new TypeError('O manipulador de mensagens deve ser uma função.')
    }
    manipuladoresMensagens.add(manipulador)
    return () => manipuladoresMensagens.delete(manipulador)
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

  return {
    iniciar,
    encerrar,
    enviarTexto,
    enviarTeste,
    obterStatus,
    obterContato,
    registrarManipuladorMensagens,
  }
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
  extrairTextoMensagem,
  extrairTelefoneRemetente,
}

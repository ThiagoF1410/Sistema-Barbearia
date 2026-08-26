const { WhatsAppError, obterClienteWhatsApp } = require('../services/whatsappService')

function criarWhatsappController({ criarCliente = obterClienteWhatsApp, logger = console } = {}) {
  function registrarFalhaSegura(req, err) {
    logger.warn('Falha no teste do WhatsApp:', {
      administradorId: req.userId,
      codigo: err.code || 'WHATSAPP_INTERNAL_ERROR',
      disconnectCode: err.disconnectCode,
    })
  }

  async function enviarTeste(req, res) {
    if (!req.is('application/json')) {
      return res.status(415).json({ message: 'Envie a requisição com Content-Type application/json.' })
    }

    const body = req.body
    if (
      body !== undefined
      && body !== null
      && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0)
    ) {
      return res.status(400).json({ message: 'O teste não aceita dados no corpo da requisição.' })
    }

    try {
      const resultado = await criarCliente().enviarTeste()
      logger.info('Teste do WhatsApp enviado pelo Baileys:', {
        administradorId: req.userId,
        messageId: resultado.messageId,
      })
      return res.status(200).json({
        message: 'Mensagem de teste enviada pelo WhatsApp.',
        messageId: resultado.messageId,
      })
    } catch (err) {
      registrarFalhaSegura(req, err)

      if (err instanceof WhatsAppError) {
        if (['WHATSAPP_NOT_CONFIGURED', 'WHATSAPP_INVALID_CONFIG', 'WHATSAPP_TEST_DISABLED'].includes(err.code)) {
          return res.status(503).json({ message: 'Integração de teste com WhatsApp ainda não está configurada.' })
        }
        if (['WHATSAPP_NOT_CONNECTED', 'WHATSAPP_CONNECTION_ERROR'].includes(err.code)) {
          return res.status(503).json({ message: 'WhatsApp ainda não está conectado. Escaneie o QR Code no terminal.' })
        }
        if (err.code === 'WHATSAPP_TIMEOUT') {
          return res.status(504).json({ message: 'A API do WhatsApp não respondeu a tempo.' })
        }
        if (['WHATSAPP_SEND_ERROR', 'WHATSAPP_INVALID_RESPONSE'].includes(err.code)) {
          return res.status(502).json({ message: 'Não foi possível enviar a mensagem de teste agora.' })
        }
      }

      return res.status(500).json({ message: 'Erro interno no servidor.' })
    }
  }

  function consultarStatus(req, res) {
    return res.status(200).json(criarCliente().obterStatus())
  }

  return { consultarStatus, enviarTeste }
}

const { consultarStatus, enviarTeste } = criarWhatsappController()

module.exports = { criarWhatsappController, consultarStatus, enviarTeste }

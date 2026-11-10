const { idValido } = require('../utils/agendaUtils')
const { obterProcessadorNotificacoesWhatsapp } = require('./notificacoesWhatsappService')

function solicitarNotificacaoWhatsapp(agendamentoId, pedidoId) {
  if (!idValido(agendamentoId) && !idValido(pedidoId)) return
  setImmediate(() => {
    const processador = obterProcessadorNotificacoesWhatsapp()
    const processamento = idValido(agendamentoId)
      ? processador.processarAgendamento(agendamentoId)
      : processador.processarPedido(pedidoId)
    processamento
      .catch((err) => console.warn('Falha ao iniciar notificação do WhatsApp:', {
        codigo: err.code || 'WHATSAPP_NOTIFICATION_ERROR',
      }))
  })
}

module.exports = { solicitarNotificacaoWhatsapp }


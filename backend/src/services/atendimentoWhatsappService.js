const pool = require('../config/db')

const ASSUNTOS = Object.freeze({
  REEMBOLSO: {
    titulo: 'Solicitação de reembolso',
    link: '/admin/pagamentos',
  },
  ALTERAR_AGENDAMENTO: {
    titulo: 'Alteração de agendamento',
    link: '/admin/agendamentos',
  },
  CANCELAR_AGENDAMENTO: {
    titulo: 'Cancelamento de agendamento',
    link: '/admin/agendamentos',
  },
  DUVIDA_PAGAMENTO: {
    titulo: 'Dúvida sobre pagamento',
    link: '/admin/pagamentos',
  },
  DUVIDA_PEDIDO: {
    titulo: 'Dúvida sobre pedido',
    link: '/admin/pagamentos',
  },
  OUTRO: {
    titulo: 'Novo contato de atendimento',
    link: '/admin/clientes',
  },
})

function identificarAssunto(texto) {
  if (typeof texto !== 'string') return null
  const correspondencia = texto.match(/(?:\[ATENDIMENTO:|ORN-)([A-Z_]+)\]?/i)
  if (!correspondencia) return null
  const codigo = correspondencia[1].toUpperCase()
  return ASSUNTOS[codigo] ? { codigo, ...ASSUNTOS[codigo] } : null
}

function telefoneFinal(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '')
  if (digitos.length < 4) return 'não identificado'
  return `final ${digitos.slice(-4)}`
}

function chaveSegura(messageId) {
  const id = String(messageId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 110)
  return id ? `ATENDIMENTO_WHATSAPP:${id}` : null
}

function criarAtendimentoWhatsappService({ db = pool, logger = console } = {}) {
  async function processarMensagem({ messageId, telefone, texto } = {}) {
    const assunto = identificarAssunto(texto)
    const chave = chaveSegura(messageId)
    if (!assunto || !chave) return { processada: false, motivo: 'MENSAGEM_FORA_DO_FLUXO' }

    const clienteResult = await db.query(
      `SELECT c.idcliente, u.nome
       FROM public.cliente c
       JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
       WHERE RIGHT(REGEXP_REPLACE(c.telefone, '\\D', '', 'g'), 11)
             = RIGHT($1, 11)
       ORDER BY c.idcliente
       LIMIT 1`,
      [telefone]
    )
    const cliente = clienteResult.rows[0]
    const remetente = cliente?.nome || `Contato ${telefoneFinal(telefone)}`
    const mensagem = `${remetente} entrou em contato pelo WhatsApp: ${assunto.titulo}.`

    await db.query(
      `SELECT public.notificar_administradores(
         $1, $2, $3, $4, $5, $6, $7
       )`,
      [
        'ATENDIMENTO_WHATSAPP',
        assunto.titulo,
        mensagem,
        assunto.link,
        'CLIENTE',
        cliente?.idcliente || null,
        chave,
      ]
    )

    logger.info('Solicitação recebida pelo WhatsApp:', {
      assunto: assunto.codigo,
      clienteId: cliente?.idcliente || null,
    })
    return {
      processada: true,
      assunto: assunto.codigo,
      clienteId: cliente?.idcliente || null,
    }
  }

  return { processarMensagem }
}

let servicoPadrao
function obterAtendimentoWhatsappService() {
  servicoPadrao ||= criarAtendimentoWhatsappService()
  return servicoPadrao
}

module.exports = {
  ASSUNTOS,
  criarAtendimentoWhatsappService,
  identificarAssunto,
  obterAtendimentoWhatsappService,
}

const pool = require('../config/db')
const { enfileirarLembretes } = require('./lembretesAtendimentoService')
const { obterClienteWhatsApp } = require('./whatsappService')

const DEFAULT_INTERVAL_MS = 30_000
const MAX_LOTE = 10

const {
  campoMensagem,
  mensagemConfirmacao,
  mensagemPedidoConfirmado,
} = require('./notificacoesMensagens')

const {
  codigoSeguro,
  criarProcessadoresNotificacoes,
} = require('./notificacoesWhatsappProcessadores')

function criarNotificacoesWhatsappService({
  db = pool,
  clienteWhatsApp = obterClienteWhatsApp(),
  env = process.env,
  logger = console,
} = {}) {
  let temporizador = null
  let processandoLote = false

  function disponivel() {
    return env.WHATSAPP_ENABLED === 'true'
      && clienteWhatsApp.obterStatus().estado === 'conectado'
  }

  async function recuperarInterrompidas() {
    const result = await db.query(
      `UPDATE public.whatsapp_notificacao
       SET status = 'FALHOU',
           ultimo_erro = 'WHATSAPP_PROCESS_INTERRUPTED',
           proxima_tentativa_em = NOW(),
           atualizado_em = NOW()
       WHERE status = 'PROCESSANDO'
         AND atualizado_em <= NOW() - INTERVAL '2 minutes'`
    )
    if (result.rowCount > 0) {
      logger.warn('Notificações interrompidas voltaram para a fila do WhatsApp:', {
        quantidade: result.rowCount,
      })
    }
    return result.rowCount
  }

  async function registrarFalha(idnotificacao, err) {
    const codigo = codigoSeguro(err)
    await db.query(
      `UPDATE public.whatsapp_notificacao
       SET status = 'FALHOU',
           ultimo_erro = $2,
           proxima_tentativa_em = NOW()
             + (LEAST(300, (POWER(2, tentativas)::INTEGER * 15)) * INTERVAL '1 second'),
           atualizado_em = NOW()
       WHERE idnotificacao = $1 AND status = 'PROCESSANDO'`,
      [idnotificacao, codigo]
    )
    logger.warn('Falha ao enviar confirmação pelo WhatsApp:', {
      idnotificacao,
      codigo,
    })
  }

  const { processarAgendamento, processarPedido } = criarProcessadoresNotificacoes({
    db,
    clienteWhatsApp,
    env,
    logger,
    disponivel,
    registrarFalha,
  })
  async function processarPendentes() {
    if (processandoLote) return
    processandoLote = true
    try {
      if (env.WHATSAPP_REMINDERS_ENABLED === 'true') await enfileirarLembretes(db)
      if (!disponivel()) return
      const pendentes = await db.query(
        `SELECT agendamento_idagendamento, pedido_idpedido
         FROM public.whatsapp_notificacao
         WHERE status IN ('PENDENTE', 'FALHOU')
           AND tentativas < 5
           AND proxima_tentativa_em <= NOW()
         ORDER BY proxima_tentativa_em, idnotificacao
         LIMIT $1`,
        [MAX_LOTE]
      )
      for (const item of pendentes.rows) {
        if (item.agendamento_idagendamento) await processarAgendamento(item.agendamento_idagendamento)
        if (item.pedido_idpedido) await processarPedido(item.pedido_idpedido)
      }
    } catch (err) {
      logger.warn('Falha ao processar notificações pendentes do WhatsApp:', {
        codigo: codigoSeguro(err),
      })
    } finally {
      processandoLote = false
    }
  }

  function iniciar() {
    if (temporizador || env.WHATSAPP_ENABLED !== 'true') return
    const intervaloMs = Number(env.WHATSAPP_NOTIFICATION_INTERVAL_MS || DEFAULT_INTERVAL_MS)
    temporizador = setInterval(processarPendentes, intervaloMs)
    temporizador.unref?.()
    setTimeout(() => {
      recuperarInterrompidas()
        .then(processarPendentes)
        .catch((err) => logger.warn('Falha ao recuperar notificações interrompidas:', {
          codigo: codigoSeguro(err),
        }))
    }, 2_000).unref?.()
  }

  function encerrar() {
    clearInterval(temporizador)
    temporizador = null
  }

  return { iniciar, encerrar, processarAgendamento, processarPedido, processarPendentes, recuperarInterrompidas }
}

let processadorPadrao
function obterProcessadorNotificacoesWhatsapp() {
  processadorPadrao ||= criarNotificacoesWhatsappService()
  return processadorPadrao
}

module.exports = {
  campoMensagem,
  criarNotificacoesWhatsappService,
  mensagemConfirmacao,
  mensagemPedidoConfirmado,
  obterProcessadorNotificacoesWhatsapp,
}

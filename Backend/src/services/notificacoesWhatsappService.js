const pool = require('../config/db')
const { obterClienteWhatsApp } = require('./whatsappService')

const TIPO_CONFIRMACAO = 'PAGAMENTO_CONFIRMADO'
const DEFAULT_INTERVAL_MS = 30_000
const MAX_LOTE = 10

function campoMensagem(valor, fallback, limite = 100) {
  const limpo = String(valor || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(limpo || fallback).slice(0, limite).join('')
}

function mensagemConfirmacao({ cliente, servico, data, horario, profissional } = {}) {
  const primeiroNome = campoMensagem(cliente, 'cliente').split(' ')[0]
  const servicoSeguro = campoMensagem(servico, 'Serviço agendado')
  const dataSegura = campoMensagem(data, 'não informada', 10)
  const horarioSeguro = campoMensagem(horario, 'não informado', 5)
  const profissionalSeguro = campoMensagem(profissional, 'Profissional da barbearia')

  return [
    `Olá, ${primeiroNome}!`,
    '',
    'Pagamento confirmado. Seu horário está reservado.',
    '',
    `Serviço: ${servicoSeguro}`,
    `Data: ${dataSegura}`,
    `Horário: ${horarioSeguro}`,
    `Profissional: ${profissionalSeguro}`,
    '',
    'O Rei da Navalha',
  ].join('\n')
}

function codigoSeguro(err) {
  const codigo = typeof err?.code === 'string' ? err.code : 'WHATSAPP_INTERNAL_ERROR'
  return /^[A-Z0-9_]{1,80}$/.test(codigo) ? codigo : 'WHATSAPP_INTERNAL_ERROR'
}

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

  async function processarAgendamento(agendamentoId) {
    if (!disponivel()) return { processada: false, motivo: 'WHATSAPP_INDISPONIVEL' }

    const reivindicada = await db.query(
      `UPDATE public.whatsapp_notificacao
       SET status = 'PROCESSANDO',
           tentativas = tentativas + 1,
           ultimo_erro = NULL,
           atualizado_em = NOW()
       WHERE idnotificacao = (
         SELECT idnotificacao
         FROM public.whatsapp_notificacao
         WHERE agendamento_idagendamento = $1
           AND tipo = $2
           AND status IN ('PENDENTE', 'FALHOU')
           AND tentativas < 5
           AND proxima_tentativa_em <= NOW()
         ORDER BY idnotificacao
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING idnotificacao`,
      [agendamentoId, TIPO_CONFIRMACAO]
    )

    if (!reivindicada.rows.length) return { processada: false, motivo: 'SEM_NOTIFICACAO_PENDENTE' }
    const idnotificacao = reivindicada.rows[0].idnotificacao

    try {
      const dados = await db.query(
        `SELECT c.telefone, u.nome AS cliente,
                a.servico_nome_snapshot AS servico,
                TO_CHAR(a.dataagendamento, 'DD/MM/YYYY') AS data,
                TO_CHAR(a.horario, 'HH24:MI') AS horario,
                up.nome AS profissional
         FROM public.whatsapp_notificacao n
         JOIN public.agendamento a
           ON a.idagendamento = n.agendamento_idagendamento
         JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
         JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
         JOIN public.profissional p
           ON p.idprofissional = a.profissional_idprofissional
         JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
         WHERE n.idnotificacao = $1`,
        [idnotificacao]
      )
      if (!dados.rows.length) {
        const err = new Error('Dados do agendamento não encontrados.')
        err.code = 'WHATSAPP_DADOS_NAO_ENCONTRADOS'
        throw err
      }

      const resultado = await clienteWhatsApp.enviarTexto({
        telefone: dados.rows[0].telefone,
        mensagem: mensagemConfirmacao(dados.rows[0]),
      })
      await db.query(
        `UPDATE public.whatsapp_notificacao
         SET status = 'ENVIADO', message_id = $2, ultimo_erro = NULL,
             enviado_em = NOW(), atualizado_em = NOW()
         WHERE idnotificacao = $1 AND status = 'PROCESSANDO'`,
        [idnotificacao, resultado.messageId]
      )
      logger.info('Confirmação enviada pelo WhatsApp:', { idnotificacao })
      return { processada: true, enviada: true, idnotificacao }
    } catch (err) {
      await registrarFalha(idnotificacao, err)
      return { processada: true, enviada: false, idnotificacao, codigo: codigoSeguro(err) }
    }
  }

  async function processarPendentes() {
    if (processandoLote || !disponivel()) return
    processandoLote = true
    try {
      const pendentes = await db.query(
        `SELECT agendamento_idagendamento
         FROM public.whatsapp_notificacao
         WHERE tipo = $1
           AND status IN ('PENDENTE', 'FALHOU')
           AND tentativas < 5
           AND proxima_tentativa_em <= NOW()
         ORDER BY proxima_tentativa_em, idnotificacao
         LIMIT $2`,
        [TIPO_CONFIRMACAO, MAX_LOTE]
      )
      for (const item of pendentes.rows) {
        await processarAgendamento(item.agendamento_idagendamento)
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
    setTimeout(processarPendentes, 2_000).unref?.()
  }

  function encerrar() {
    clearInterval(temporizador)
    temporizador = null
  }

  return { iniciar, encerrar, processarAgendamento, processarPendentes }
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
  obterProcessadorNotificacoesWhatsapp,
}

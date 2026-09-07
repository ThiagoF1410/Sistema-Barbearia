const pool = require('../config/db')
const { obterClienteWhatsApp } = require('./whatsappService')
const { getStripe, recuperarSessaoCheckout } = require('./stripeService')

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
    '✦ *O Rei da Navalha* ✦',
    '',
    `Olá, *${primeiroNome}*! 💈`,
    '',
    '✅ *Pagamento confirmado!*',
    'Seu horário está reservado com sucesso.',
    '',
    '━━━━━━━━━━━━━━',
    `✂️ *Serviço:* ${servicoSeguro}`,
    `📅 *Data:* ${dataSegura}`,
    `🕒 *Horário:* ${horarioSeguro}`,
    `👤 *Profissional:* ${profissionalSeguro}`,
    '━━━━━━━━━━━━━━',
    '',
    'Obrigado pela preferência. Aguardamos você! 👑',
  ].join('\n')
}

function mensagemReservaOnline(dados = {}) {
  const primeiroNome = campoMensagem(dados.cliente, 'cliente').split(' ')[0]
  return [
    '✂️ *O Rei da Navalha*',
    '',
    `Olá, ${primeiroNome}! Seu horário foi reservado temporariamente.`,
    '',
    `✂️ *Serviço:* ${campoMensagem(dados.servico, 'Serviço agendado')}`,
    `📅 *Data:* ${campoMensagem(dados.data, 'não informada', 10)}`,
    `⏰ *Horário:* ${campoMensagem(dados.horario, 'não informado', 5)}`,
    `💈 *Profissional:* ${campoMensagem(dados.profissional, 'Profissional da barbearia')}`,
    `💵 *Valor:* ${campoMensagem(dados.valor_formatado, 'não informado', 30)}`,
    '',
    `⌛ Conclua o pagamento até *${campoMensagem(dados.limite, 'o horário informado', 5)}*.`,
    '',
    '🔗 *Pagar agora:*',
    campoMensagem(dados.checkout_url, 'Link indisponível', 1000),
    '',
    'Após esse prazo, o horário será liberado automaticamente.',
  ].join('\n')
}

function mensagemLembrete(dados = {}) {
  return [
    '⏳ *Seu prazo está terminando!*',
    '',
    'Faltam aproximadamente *3 minutos* para confirmar seu agendamento.',
    '',
    '🔗 *Finalize o pagamento:*',
    campoMensagem(dados.checkout_url, 'Link indisponível', 1000),
    '',
    'Caso o pagamento já tenha sido realizado, desconsidere esta mensagem.',
    '*O Rei da Navalha* ✂️',
  ].join('\n')
}

function mensagemExpirada({ cliente } = {}) {
  const primeiroNome = campoMensagem(cliente, 'cliente').split(' ')[0]
  return [
    '⌛ *Prazo de pagamento encerrado*',
    '',
    `Olá, ${primeiroNome}. O pagamento não foi identificado dentro do prazo e o horário foi liberado.`,
    '',
    '📅 Para escolher um novo horário, acesse:',
    `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/agendar`,
    '',
    '*O Rei da Navalha* ✂️',
  ].join('\n')
}

function mensagemReservaDinheiro(dados = {}) {
  const primeiroNome = campoMensagem(dados.cliente, 'cliente').split(' ')[0]
  return [
    '✂️ *O Rei da Navalha*',
    '',
    `Olá, ${primeiroNome}! Seu horário foi reservado.`,
    '',
    `✂️ *Serviço:* ${campoMensagem(dados.servico, 'Serviço agendado')}`,
    `📅 *Data:* ${campoMensagem(dados.data, 'não informada', 10)}`,
    `⏰ *Horário:* ${campoMensagem(dados.horario, 'não informado', 5)}`,
    `💈 *Profissional:* ${campoMensagem(dados.profissional, 'Profissional da barbearia')}`,
    '💵 *Pagamento:* Dinheiro na barbearia',
    '',
    'Seu agendamento está registrado. Aguardamos você! ✅',
  ].join('\n')
}

function mensagemPedidoConfirmado({ cliente, pedido, itens, valor_formatado } = {}) {
  const primeiroNome = campoMensagem(cliente, 'cliente').split(' ')[0]
  return [
    '🛍️ *O Rei da Navalha*',
    '',
    `Olá, *${primeiroNome}*! ✅`,
    '',
    '✨ *Pagamento do seu pedido confirmado!*',
    'Seu pedido já está separado para retirada na barbearia.',
    '',
    '━━━━━━━━━━━━━━━━',
    `📦 *Pedido:* #${campoMensagem(pedido, '—', 20)}`,
    `🧴 *Itens:* ${campoMensagem(itens, 'Produtos selecionados', 700)}`,
    `💰 *Total pago:* ${campoMensagem(valor_formatado, 'não informado', 30)}`,
    `📍 *Retirada:* na barbearia`,
    '━━━━━━━━━━━━━━━━',
    '',
    'Obrigado pela preferência! 👑',
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
           AND status IN ('PENDENTE', 'FALHOU')
           AND tentativas < 5
           AND proxima_tentativa_em <= NOW()
         ORDER BY idnotificacao
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING idnotificacao, tipo`,
      [agendamentoId]
    )

    if (!reivindicada.rows.length) return { processada: false, motivo: 'SEM_NOTIFICACAO_PENDENTE' }
    const idnotificacao = reivindicada.rows[0].idnotificacao
    const tipoReivindicado = reivindicada.rows[0].tipo || TIPO_CONFIRMACAO

    try {
      const dados = await db.query(
        `SELECT c.telefone, u.nome AS cliente,
                a.servico_nome_snapshot AS servico,
                TO_CHAR(a.dataagendamento, 'DD/MM/YYYY') AS data,
                TO_CHAR(a.horario, 'HH24:MI') AS horario,
                up.nome AS profissional, n.tipo,
                pg.statuspagamento, pg.metodo, pg.valor,
                pg.stripe_checkout_session_id,
                pg.checkout_expira_em,
                TO_CHAR(pg.checkout_expira_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS limite
         FROM public.whatsapp_notificacao n
         JOIN public.agendamento a
           ON a.idagendamento = n.agendamento_idagendamento
         JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
         JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
         JOIN public.profissional p
           ON p.idprofissional = a.profissional_idprofissional
         JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
         LEFT JOIN public.pagamento pg
           ON pg.agendamento_idagendamento = a.idagendamento
         WHERE n.idnotificacao = $1`,
        [idnotificacao]
      )
      if (!dados.rows.length) {
        const err = new Error('Dados do agendamento não encontrados.')
        err.code = 'WHATSAPP_DADOS_NAO_ENCONTRADOS'
        throw err
      }

      const item = { ...dados.rows[0], tipo: dados.rows[0].tipo || tipoReivindicado }
      item.valor_formatado = Number(item.valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      let mensagem
      if (item.tipo === 'RESERVA_PAGAMENTO' || item.tipo === 'LEMBRETE_PAGAMENTO') {
        const dentroDoPrazo = item.checkout_expira_em
          && new Date(item.checkout_expira_em).getTime() > Date.now()
        if (item.metodo !== 'STRIPE' || item.statuspagamento !== 'PENDENTE' || !dentroDoPrazo) {
          await db.query(
            `UPDATE public.whatsapp_notificacao
             SET status = 'ENVIADO', message_id = 'IGNORADA', atualizado_em = NOW()
             WHERE idnotificacao = $1 AND status = 'PROCESSANDO'`,
            [idnotificacao]
          )
          return { processada: true, enviada: false, ignorada: true, idnotificacao }
        }
        const sessao = await recuperarSessaoCheckout(getStripe(), item.stripe_checkout_session_id)
        if (!sessao?.url || sessao.status !== 'open') {
          const err = new Error('Sessão de pagamento indisponível para notificação.')
          err.code = 'STRIPE_CHECKOUT_INDISPONIVEL'
          throw err
        }
        item.checkout_url = sessao.url
        mensagem = item.tipo === 'RESERVA_PAGAMENTO'
          ? mensagemReservaOnline(item)
          : mensagemLembrete(item)
      } else if (item.tipo === 'PAGAMENTO_EXPIRADO') {
        mensagem = mensagemExpirada(item)
      } else if (item.tipo === 'RESERVA_DINHEIRO') {
        if (item.metodo !== 'DINHEIRO' || item.statuspagamento !== 'PENDENTE') {
          await db.query(
            `UPDATE public.whatsapp_notificacao
             SET status = 'ENVIADO', message_id = 'IGNORADA', atualizado_em = NOW()
             WHERE idnotificacao = $1 AND status = 'PROCESSANDO'`,
            [idnotificacao]
          )
          return { processada: true, enviada: false, ignorada: true, idnotificacao }
        }
        mensagem = mensagemReservaDinheiro(item)
      } else {
        mensagem = mensagemConfirmacao(item)
      }

      const resultado = await clienteWhatsApp.enviarTexto({
        telefone: item.telefone,
        mensagem,
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

  async function processarPedido(pedidoId) {
    if (!disponivel()) return { processada: false, motivo: 'WHATSAPP_INDISPONIVEL' }
    const reivindicada = await db.query(
      `UPDATE public.whatsapp_notificacao SET status = 'PROCESSANDO', tentativas = tentativas + 1,
              ultimo_erro = NULL, atualizado_em = NOW()
       WHERE idnotificacao = (
         SELECT idnotificacao FROM public.whatsapp_notificacao
         WHERE pedido_idpedido = $1 AND status IN ('PENDENTE', 'FALHOU')
           AND tentativas < 5 AND proxima_tentativa_em <= NOW()
         ORDER BY idnotificacao FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING idnotificacao`,
      [pedidoId]
    )
    if (!reivindicada.rows.length) return { processada: false, motivo: 'SEM_NOTIFICACAO_PENDENTE' }
    const idnotificacao = reivindicada.rows[0].idnotificacao
    try {
      const dados = await db.query(
        `SELECT c.telefone, u.nome AS cliente, pe.idpedido AS pedido, pg.valor,
                STRING_AGG(CONCAT(pi.quantidade, 'x ', pi.nome_snapshot), ' · ' ORDER BY pi.idpedidoitem) AS itens
         FROM public.whatsapp_notificacao n
         JOIN public.pedido pe ON pe.idpedido = n.pedido_idpedido
         JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
         JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
         JOIN public.pagamento pg ON pg.pedido_idpedido = pe.idpedido
         JOIN public.pedido_item pi ON pi.pedido_idpedido = pe.idpedido
         WHERE n.idnotificacao = $1 AND pe.status = 'CONFIRMADO' AND pg.statuspagamento = 'CONFIRMADO'
         GROUP BY c.telefone, u.nome, pe.idpedido, pg.valor`,
        [idnotificacao]
      )
      if (!dados.rows.length) {
        await db.query(`UPDATE public.whatsapp_notificacao SET status = 'ENVIADO', message_id = 'IGNORADA', atualizado_em = NOW() WHERE idnotificacao = $1`, [idnotificacao])
        return { processada: true, enviada: false, ignorada: true, idnotificacao }
      }
      const item = dados.rows[0]
      item.valor_formatado = Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      const resultado = await clienteWhatsApp.enviarTexto({ telefone: item.telefone, mensagem: mensagemPedidoConfirmado(item) })
      await db.query(`UPDATE public.whatsapp_notificacao SET status = 'ENVIADO', message_id = $2, ultimo_erro = NULL, enviado_em = NOW(), atualizado_em = NOW() WHERE idnotificacao = $1 AND status = 'PROCESSANDO'`, [idnotificacao, resultado.messageId])
      logger.info('Confirmação de pedido enviada pelo WhatsApp:', { idnotificacao })
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

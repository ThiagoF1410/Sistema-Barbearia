const { PREFIXO, lembreteValido, mensagemLembreteAtendimento } = require('./lembretesAtendimentoService')
const { getStripe, recuperarSessaoCheckout } = require('./stripeService')
const {
  mensagemConfirmacao,
  mensagemReservaOnline,
  mensagemLembrete,
  mensagemExpirada,
  mensagemReservaDinheiro,
  mensagemPedidoConfirmado,
} = require('./notificacoesMensagens')

const TIPO_CONFIRMACAO = 'PAGAMENTO_CONFIRMADO'

function codigoSeguro(err) {
  const codigo = typeof err?.code === 'string' ? err.code : 'WHATSAPP_INTERNAL_ERROR'
  return /^[A-Z0-9_]{1,80}$/.test(codigo) ? codigo : 'WHATSAPP_INTERNAL_ERROR'
}

function criarProcessadoresNotificacoes({
  db,
  clienteWhatsApp,
  env,
  logger,
  disponivel,
  registrarFalha,
}) {
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
                COALESCE((
                  SELECT STRING_AGG(
                    pi.quantidade || '× ' || pi.nome_snapshot,
                    ', ' ORDER BY pi.idpedidoitem
                  )
                  FROM public.pedido_item pi
                  WHERE pi.pedido_idpedido = pg.pedido_idpedido
                ), '') AS produtos,
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
      if (item.tipo.startsWith(PREFIXO)) {
        const atual = await db.query(`SELECT a.statusagendamento, c.receber_lembretes_whatsapp,
          a.lembrete_reservado_em, n.lembrete_inicio,
          (a.dataagendamento + a.horario) AT TIME ZONE 'America/Sao_Paulo' AS inicio_atendimento
          FROM public.whatsapp_notificacao n JOIN public.agendamento a ON a.idagendamento = n.agendamento_idagendamento
          JOIN public.cliente c ON c.idcliente = a.cliente_idcliente WHERE n.idnotificacao = $1`, [idnotificacao])
        Object.assign(item, atual.rows[0])
        if (env.WHATSAPP_REMINDERS_ENABLED !== 'true' || !lembreteValido(item)) {
          await db.query("UPDATE public.whatsapp_notificacao SET status = 'ENVIADO', message_id = 'IGNORADA', atualizado_em = NOW() WHERE idnotificacao = $1 AND status = 'PROCESSANDO'", [idnotificacao])
          return { processada: true, enviada: false, ignorada: true, idnotificacao }
        }
      }
      item.valor_formatado = Number(item.valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })

      let mensagem
      if (item.tipo.startsWith(PREFIXO)) {
        mensagem = mensagemLembreteAtendimento(item, env.FRONTEND_URL || 'http://localhost:5173')
      } else if (item.tipo === 'RESERVA_PAGAMENTO' || item.tipo === 'LEMBRETE_PAGAMENTO') {
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

  return { processarAgendamento, processarPedido }
}

module.exports = { codigoSeguro, criarProcessadoresNotificacoes }


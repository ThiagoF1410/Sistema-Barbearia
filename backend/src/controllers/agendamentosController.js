const pool = require('../config/db')
const { HORA, dataIsoValida, horarioNaGrade, horaParaMinutos, idValido } = require('../utils/agendaUtils')
const { normalizarPaginacao, montarPaginacao } = require('../utils/paginationUtils')
const {
  getStripe,
  idPaymentIntentDaSessao,
  recuperarSessaoCheckout,
} = require('../services/stripeService')

async function criar(req, res) {
  const { servicoId, profissionalId, data, horario } = req.body || {}
  if (!idValido(servicoId) || !idValido(profissionalId) || !dataIsoValida(data) || !HORA.test(horario || '')) {
    return res.status(400).json({ message: 'Informe serviço, profissional, data e horário válidos.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('agenda_global'), 0)")
    await client.query(
      "SELECT pg_advisory_xact_lock_shared(hashtext('agenda_profissional'), $1::integer)",
      [profissionalId]
    )
    const cliente = await client.query('SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1', [req.userId])
    if (!cliente.rows.length) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'Somente clientes podem realizar agendamentos.' })
    }

    const [servico, profissional, funcionamento, feriado, excecao, ausencia, relogio] = await Promise.all([
      client.query(
        `SELECT idservico, nome, duracao, preco FROM public.servico
         WHERE idservico = $1 AND tipo = 'servico'`, [servicoId]
      ),
      client.query(
        `SELECT p.idprofissional, u.nome FROM public.profissional p
         JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
         WHERE p.idprofissional = $1 AND p.ativo = TRUE`, [profissionalId]
      ),
      client.query(
        `SELECT ativo, TO_CHAR(hora_abertura, 'HH24:MI') AS abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS fechamento,
                intervalo_ativo,
                TO_CHAR(hora_inicio_intervalo, 'HH24:MI') AS inicio_intervalo,
                TO_CHAR(hora_fim_intervalo, 'HH24:MI') AS fim_intervalo
         FROM (
           SELECT 0 AS prioridade, hp.ativo, hp.hora_abertura, hp.hora_fechamento,
                  hp.intervalo_ativo, hp.hora_inicio_intervalo, hp.hora_fim_intervalo
           FROM public.horario_profissional hp
           WHERE hp.profissional_idprofissional = $2
             AND hp.dia_semana = EXTRACT(DOW FROM $1::date)::INTEGER
           UNION ALL
           SELECT 1, hf.ativo, hf.hora_abertura, hf.hora_fechamento,
                  hf.intervalo_ativo, hf.hora_inicio_intervalo, hf.hora_fim_intervalo
           FROM public.horario_funcionamento hf
           WHERE hf.dia_semana = EXTRACT(DOW FROM $1::date)::INTEGER
         ) AS regras
         ORDER BY prioridade
         LIMIT 1`, [data, profissionalId]
      ),
      client.query(
        `SELECT nome, modo_funcionamento,
                TO_CHAR(hora_abertura, 'HH24:MI') AS abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS fechamento
         FROM public.feriado WHERE data = $1::date`, [data]
      ),
      client.query('SELECT disponivel FROM public.agenda WHERE data = $1::date', [data]),
      client.query(
        `SELECT tipo, descricao
         FROM public.disponibilidade
         WHERE profissional_idprofissional = $1
           AND $2::date BETWEEN datainicio AND datafim
         ORDER BY datainicio DESC, iddisponibilidade DESC
         LIMIT 1`,
        [profissionalId, data]
      ),
      client.query(
        `SELECT TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS data,
                TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS horario`
      ),
    ])

    if (!servico.rows.length || !profissional.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Serviço ou profissional não encontrado.' })
    }
    if (data < relogio.rows[0].data || (data === relogio.rows[0].data && horario <= relogio.rows[0].horario)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este horário já passou. Escolha outro.' })
    }
    if (excecao.rows[0]?.disponivel === false) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Esta data está bloqueada pelo administrador.' })
    }
    if (ausencia.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: ausencia.rows[0].descricao || 'O profissional está indisponível nesta data.',
      })
    }

    const regra = funcionamento.rows[0]
    const regraFeriado = feriado.rows[0]
    let aberto = Boolean(regra?.ativo)
    let abertura = regra?.abertura
    let fechamento = regra?.fechamento
    if (regraFeriado?.modo_funcionamento === 'fechado') aberto = false
    if (regraFeriado?.modo_funcionamento === 'horario_especial') {
      aberto = Boolean(regra?.ativo)
      abertura = regraFeriado.abertura
      fechamento = regraFeriado.fechamento
    }
    if (!aberto || !abertura || !fechamento) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'A barbearia está fechada nesta data.' })
    }

    const inicio = horaParaMinutos(horario)
    const duracao = Number(servico.rows[0].duracao)
    const fim = inicio + duracao
    const minutosAbertura = horaParaMinutos(abertura)
    const minutosFechamento = horaParaMinutos(fechamento)
    const alinhado = horarioNaGrade(inicio, minutosAbertura)
    const cruzaIntervalo = Boolean(regra?.intervalo_ativo)
      && inicio < horaParaMinutos(regra.fim_intervalo)
      && fim > horaParaMinutos(regra.inicio_intervalo)
    if (inicio < minutosAbertura || fim > minutosFechamento || !alinhado || cruzaIntervalo) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'O horário selecionado não está mais disponível.' })
    }

    // Serializa reservas do mesmo profissional e dia para evitar que duas
    // requisições simultâneas confirmem intervalos sobrepostos.
    await client.query(
      'SELECT pg_advisory_xact_lock($1::integer, hashtext($2::text))',
      [profissionalId, data]
    )

    const conflito = await client.query(
      `SELECT 1
       FROM public.agendamento a
       JOIN public.servico s ON s.idservico = a.servico_idservico
       WHERE a.profissional_idprofissional = $1
         AND a.dataagendamento = $2::date
         AND a.statusagendamento <> 'CANCELADO'
         AND a.horario < ($3::time + ($4 * INTERVAL '1 minute'))
         AND (a.horario + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute')) > $3::time
       LIMIT 1`,
      [profissionalId, data, horario, duracao]
    )
    if (conflito.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este horário conflita com outro atendimento. Escolha outro.' })
    }

    const agenda = await client.query(
      `INSERT INTO public.agenda (data, disponivel) VALUES ($1::date, TRUE)
       ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data
       RETURNING idagenda, disponivel`, [data]
    )
    if (!agenda.rows[0].disponivel) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Esta data está bloqueada pelo administrador.' })
    }
    const result = await client.query(
      `INSERT INTO public.agendamento
       (agenda_idagenda, cliente_idcliente, profissional_idprofissional, servico_idservico,
        dataagendamento, horario, statusagendamento,
        servico_nome_snapshot, duracao_snapshot, valor_snapshot)
       VALUES ($1, $2, $3, $4, $5::date, $6::time, 'AGENDADO', $7, $8, $9)
       RETURNING idagendamento, TO_CHAR(dataagendamento, 'YYYY-MM-DD') AS data,
                 TO_CHAR(horario, 'HH24:MI') AS horario, statusagendamento`,
      [agenda.rows[0].idagenda, cliente.rows[0].idcliente, profissionalId, servicoId, data, horario,
        servico.rows[0].nome, duracao, servico.rows[0].preco]
    )
    await client.query('COMMIT')
    return res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505' || err.code === '23P01') {
      return res.status(409).json({ message: 'Este horário acabou de ser reservado. Escolha outro.' })
    }
    console.error('Erro ao criar agendamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function listarMeus(req, res) {
  const paginacao = normalizarPaginacao(req.query)
  if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })
  const status = String(req.query.status || '').trim().toUpperCase()
  if (status && !['AGENDADO', 'CONCLUIDO', 'CANCELADO'].includes(status)) {
    return res.status(400).json({ message: 'Situacao do agendamento invalida.' })
  }
  try {
    if (paginacao.solicitada) {
      const valores = [req.userId]
      const filtroStatus = status ? `AND a.statusagendamento = $2` : ''
      if (status) valores.push(status)
      valores.push(paginacao.limite, paginacao.offset)
      const limitePosicao = valores.length - 1
      const [result, contagem, resumo] = await Promise.all([
        pool.query(
          `SELECT a.idagendamento,
                  TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                  TO_CHAR(a.horario, 'HH24:MI') AS horario,
                  a.statusagendamento, a.servico, a.duracao, a.preco, a.profissional,
                  p.statuspagamento, p.metodo, p.checkout_expira_em,
                  ((a.dataagendamento + a.horario) > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                    AND a.statusagendamento = 'AGENDADO'
                    AND COALESCE(p.metodo, 'STRIPE') <> 'DINHEIRO'
                    AND (p.checkout_expira_em IS NULL OR p.checkout_expira_em > NOW())
                    AND COALESCE(p.statuspagamento, '') NOT IN ('CONFIRMADO', 'PAGO') AS pode_pagar,
                  ((a.dataagendamento + a.horario) > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 hours')
                    AND a.statusagendamento = 'AGENDADO' AS pode_cancelar
           FROM public.vw_agendamentos_completos a
           LEFT JOIN public.pagamento p ON p.agendamento_idagendamento = a.idagendamento
           WHERE a.cliente_usuario_id = $1 ${filtroStatus}
           ORDER BY a.dataagendamento DESC, a.horario DESC
           LIMIT $${limitePosicao} OFFSET $${limitePosicao + 1}`,
          valores
        ),
        pool.query(
          `SELECT COUNT(*)::integer AS total FROM public.vw_agendamentos_completos a
           WHERE a.cliente_usuario_id = $1 ${filtroStatus}`,
          valores.slice(0, limitePosicao - 1)
        ),
        pool.query(
          `SELECT COUNT(*)::integer AS total,
                  COUNT(*) FILTER (WHERE statusagendamento = 'AGENDADO')::integer AS agendados,
                  COUNT(*) FILTER (WHERE statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                  COUNT(*) FILTER (WHERE statusagendamento = 'CANCELADO')::integer AS cancelados
           FROM public.vw_agendamentos_completos WHERE cliente_usuario_id = $1`,
          [req.userId]
        ),
      ])
      return res.status(200).json({
        agendamentos: result.rows,
        resumo: resumo.rows[0],
        paginacao: montarPaginacao(contagem.rows[0]?.total, paginacao.pagina, paginacao.limite),
      })
    }
    const result = await pool.query(
      `SELECT a.idagendamento,
              TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
              TO_CHAR(a.horario, 'HH24:MI') AS horario,
              a.statusagendamento,
              a.servico, a.duracao, a.preco,
              a.profissional,
              p.statuspagamento, p.metodo, p.checkout_expira_em,
              ((a.dataagendamento + a.horario)
                > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                AND a.statusagendamento = 'AGENDADO'
                AND COALESCE(p.metodo, 'STRIPE') <> 'DINHEIRO'
                AND (p.checkout_expira_em IS NULL OR p.checkout_expira_em > NOW())
                AND COALESCE(p.statuspagamento, '') NOT IN ('CONFIRMADO', 'PAGO') AS pode_pagar,
              ((a.dataagendamento + a.horario)
                > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 hours')
                AND a.statusagendamento = 'AGENDADO' AS pode_cancelar
       FROM public.vw_agendamentos_completos a
       LEFT JOIN public.pagamento p
         ON p.agendamento_idagendamento = a.idagendamento
       WHERE a.cliente_usuario_id = $1
       ORDER BY a.dataagendamento DESC, a.horario DESC`,
      [req.userId]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar agendamentos do cliente:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function cancelar(req, res) {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Agendamento inválido.' })

  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true

    const existente = await client.query(
      `SELECT a.idagendamento, a.statusagendamento,
              (a.dataagendamento + a.horario)
                > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 hours' AS dentro_prazo
       FROM public.agendamento a
       JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
       WHERE a.idagendamento = $1 AND c.usuario_idusuario = $2
       FOR UPDATE OF a`,
      [req.params.id, req.userId]
    )

    if (!existente.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Agendamento não encontrado.' })
    }

    if (existente.rows[0].statusagendamento !== 'AGENDADO') {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Este agendamento não está ativo.' })
    }
    if (!existente.rows[0].dentro_prazo) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'O cancelamento deve ser feito com mais de 2 horas de antecedência.' })
    }

    const pagamentoResult = await client.query(
      `SELECT idpagamento, statuspagamento, stripe_checkout_session_id
       FROM public.pagamento
       WHERE agendamento_idagendamento = $1
       FOR UPDATE`,
      [req.params.id]
    )
    const pagamento = pagamentoResult.rows[0]

    if (['CONFIRMADO', 'PAGO'].includes(pagamento?.statuspagamento)) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({
        message: 'Este agendamento já foi pago. Entre em contato com a barbearia para solicitar cancelamento e estorno.',
      })
    }

    if (pagamento?.stripe_checkout_session_id) {
      const stripe = getStripe()
      const sessao = await recuperarSessaoCheckout(stripe, pagamento.stripe_checkout_session_id)

      if (sessao?.payment_status === 'paid') {
        await client.query(
          `UPDATE public.pagamento
           SET statuspagamento = 'CONFIRMADO',
               stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
               atualizado_em = NOW()
           WHERE idpagamento = $1`,
          [pagamento.idpagamento, idPaymentIntentDaSessao(sessao)]
        )
        await client.query('COMMIT')
        transacaoAtiva = false
        return res.status(409).json({
          message: 'O pagamento já foi confirmado. Entre em contato com a barbearia para solicitar cancelamento e estorno.',
        })
      }

      if (
        sessao?.status === 'complete'
        && pagamento.statuspagamento !== 'FALHOU'
      ) {
        await client.query('ROLLBACK')
        transacaoAtiva = false
        return res.status(409).json({
          message: 'O pagamento está em processamento. Aguarde a confirmação antes de cancelar.',
        })
      }

      if (sessao?.status === 'open') {
        await stripe.checkout.sessions.expire(sessao.id)
      }
    }

    const result = await client.query(
      `UPDATE public.agendamento
       SET statusagendamento = 'CANCELADO'
       WHERE idagendamento = $1
       RETURNING idagendamento, statusagendamento`,
      [req.params.id]
    )

    if (pagamento) {
      await client.query(
        `UPDATE public.pagamento
         SET statuspagamento = 'CANCELADO', atualizado_em = NOW()
         WHERE idpagamento = $1
           AND statuspagamento IN ('PENDENTE', 'FALHOU', 'CANCELADO')`,
        [pagamento.idpagamento]
      )
    }

    await client.query('COMMIT')
    transacaoAtiva = false
    return res.status(200).json({ message: 'Agendamento cancelado.', ...result.rows[0] })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Não foi possível cancelar o pagamento agora.' })
    }
    console.error('Erro ao cancelar agendamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function listarAdmin(req, res) {
  const { data, dataInicio, dataFim, profissionalId, status, statusPagamento, busca } = req.query
  if (data && !dataIsoValida(data)) return res.status(400).json({ message: 'Data inválida.' })
  if (dataInicio && !dataIsoValida(dataInicio)) return res.status(400).json({ message: 'Data inicial inválida.' })
  if (dataFim && !dataIsoValida(dataFim)) return res.status(400).json({ message: 'Data final inválida.' })
  if (dataInicio && dataFim && dataInicio > dataFim) return res.status(400).json({ message: 'A data inicial não pode ser posterior à data final.' })
  if (profissionalId && !idValido(profissionalId)) return res.status(400).json({ message: 'Profissional inválido.' })

  const statusNormalizado = String(status || '').toUpperCase()
  const pagamentoNormalizado = String(statusPagamento || '').toUpperCase()
  if (status && !['AGENDADO', 'CONCLUIDO', 'CANCELADO'].includes(statusNormalizado)) {
    return res.status(400).json({ message: 'Situação do atendimento inválida.' })
  }
  if (statusPagamento && !['PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU'].includes(pagamentoNormalizado)) {
    return res.status(400).json({ message: 'Situação do pagamento inválida.' })
  }
  const paginacao = normalizarPaginacao(req.query)
  if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })

  try {
    const filtros = []
    const valores = []
    if (data) {
      valores.push(data)
      filtros.push(`a.dataagendamento = $${valores.length}::date`)
    }
    if (dataInicio) {
      valores.push(dataInicio)
      filtros.push(`a.dataagendamento >= $${valores.length}::date`)
    }
    if (dataFim) {
      valores.push(dataFim)
      filtros.push(`a.dataagendamento <= $${valores.length}::date`)
    }
    if (profissionalId) {
      valores.push(profissionalId)
      filtros.push(`a.idprofissional = $${valores.length}`)
    }
    if (status) {
      valores.push(statusNormalizado)
      filtros.push(`a.statusagendamento = $${valores.length}`)
    }
    if (statusPagamento) {
      valores.push(pagamentoNormalizado)
      filtros.push(`pag.statuspagamento = $${valores.length}`)
    }
    if (typeof busca === 'string' && busca.trim()) {
      valores.push(`%${busca.trim()}%`)
      filtros.push(`(a.cliente ILIKE $${valores.length}
        OR a.cliente_email ILIKE $${valores.length}
        OR c.telefone ILIKE $${valores.length})`)
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''
    if (paginacao.solicitada) {
      const valoresLista = [...valores, paginacao.limite, paginacao.offset]
      const limitePosicao = valoresLista.length - 1
      const from = `FROM public.vw_agendamentos_completos a
        JOIN public.cliente c ON c.idcliente = a.idcliente
        LEFT JOIN public.pagamento pag ON pag.agendamento_idagendamento = a.idagendamento
        ${where}`
      const [result, resumoResult] = await Promise.all([
        pool.query(
          `SELECT a.idagendamento, TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                  TO_CHAR(a.horario, 'HH24:MI') AS horario, a.statusagendamento,
                  a.idcliente, a.cliente, a.cliente_email, c.telefone AS cliente_telefone,
                  a.idprofissional, a.profissional, a.especialidade,
                  a.idservico, a.servico, a.duracao, a.preco,
                  pag.statuspagamento, pag.metodo,
                  ((a.dataagendamento + a.horario) + (a.duracao * INTERVAL '1 minute')
                    <= CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                    AND a.statusagendamento = 'AGENDADO' AS pode_concluir
           ${from}
           ORDER BY a.dataagendamento DESC, a.horario ASC
           LIMIT $${limitePosicao} OFFSET $${limitePosicao + 1}`,
          valoresLista
        ),
        pool.query(
          `SELECT COUNT(*)::integer AS total,
                  COUNT(*) FILTER (WHERE a.statusagendamento = 'AGENDADO')::integer AS agendados,
                  COUNT(*) FILTER (WHERE a.statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                  COUNT(*) FILTER (WHERE a.statusagendamento = 'CANCELADO')::integer AS cancelados,
                  COALESCE(SUM(a.preco) FILTER (WHERE pag.statuspagamento = 'CONFIRMADO' AND a.statusagendamento <> 'CANCELADO'), 0)::numeric AS faturamento
           ${from}`,
          valores
        ),
      ])
      const resumo = resumoResult.rows[0] || {}
      return res.status(200).json({
        agendamentos: result.rows,
        resumo,
        paginacao: montarPaginacao(resumo.total, paginacao.pagina, paginacao.limite),
      })
    }
    const result = await pool.query(
      `SELECT a.idagendamento, TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
              TO_CHAR(a.horario, 'HH24:MI') AS horario, a.statusagendamento,
              a.idcliente, a.cliente, a.cliente_email, c.telefone AS cliente_telefone,
              a.idprofissional, a.profissional, a.especialidade,
              a.idservico, a.servico, a.duracao, a.preco,
              pag.statuspagamento, pag.metodo,
              ((a.dataagendamento + a.horario)
                + (a.duracao * INTERVAL '1 minute')
                <= CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                AND a.statusagendamento = 'AGENDADO' AS pode_concluir
       FROM public.vw_agendamentos_completos a
       JOIN public.cliente c ON c.idcliente = a.idcliente
       LEFT JOIN public.pagamento pag
         ON pag.agendamento_idagendamento = a.idagendamento
       ${where}
       ORDER BY a.dataagendamento DESC, a.horario ASC`,
      valores
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar agendamentos para o administrador:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function dashboardAdmin(req, res) {
  const data = req.query.data || null
  if (data && !dataIsoValida(data)) {
    return res.status(400).json({ message: 'Data inválida.' })
  }

  try {
    const dataResult = await pool.query(
      `SELECT COALESCE(
         $1::date,
         (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
       ) AS data`,
      [data]
    )
    const dataSelecionada = dataResult.rows[0].data

    const [agendaResult, resumoResult, cadastrosResult, faturamentoResult] = await Promise.all([
      pool.query(
        `SELECT a.idagendamento,
                TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                TO_CHAR(a.horario, 'HH24:MI') AS horario,
                a.statusagendamento,
                a.cliente,
                a.cliente_email,
                a.profissional,
                a.servico,
                a.duracao,
                a.preco,
                pagamento.statuspagamento, pagamento.metodo
         FROM public.vw_agendamentos_completos a
         LEFT JOIN LATERAL (
           SELECT p.statuspagamento, p.metodo
           FROM public.pagamento p
           WHERE p.agendamento_idagendamento = a.idagendamento
           ORDER BY p.idpagamento DESC
           LIMIT 1
         ) pagamento ON TRUE
         WHERE a.dataagendamento = $1::date
         ORDER BY a.horario, a.profissional, a.idagendamento`,
        [dataSelecionada]
      ),
      pool.query(
        `SELECT COUNT(*)::integer AS total,
                COUNT(*) FILTER (WHERE statusagendamento = 'AGENDADO')::integer AS agendados,
                COUNT(*) FILTER (WHERE statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                COUNT(*) FILTER (WHERE statusagendamento = 'CANCELADO')::integer AS cancelados
         FROM public.vw_agendamentos_completos
         WHERE dataagendamento = $1::date`,
        [dataSelecionada]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM public.cliente) AS clientes,
           (SELECT COUNT(*)::integer FROM public.profissional WHERE ativo = TRUE) AS profissionais`
      ),
      pool.query(
        `SELECT COALESCE(SUM(p.valor), 0)::numeric(12, 2) AS total
         FROM public.pagamento p
         JOIN public.agendamento a
           ON a.idagendamento = p.agendamento_idagendamento
         WHERE p.statuspagamento = 'CONFIRMADO'
           AND a.dataagendamento >= DATE_TRUNC('month', $1::date)::date
           AND a.dataagendamento < (DATE_TRUNC('month', $1::date) + INTERVAL '1 month')::date`,
        [dataSelecionada]
      ),
    ])

    return res.status(200).json({
      data: dataSelecionada,
      resumo: {
        ...resumoResult.rows[0],
        ...cadastrosResult.rows[0],
        faturamentoMes: faturamentoResult.rows[0].total,
      },
      agendamentos: agendaResult.rows,
    })
  } catch (err) {
    console.error('Erro ao carregar dashboard administrativo:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function dashboardProfissional(req, res) {
  const data = req.query.data || null
  if (data && !dataIsoValida(data)) {
    return res.status(400).json({ message: 'Data inválida.' })
  }

  try {
    const profissionalResult = await pool.query(
      `SELECT p.idprofissional, u.nome, u.email, p.especialidade
       FROM public.profissional p
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       WHERE p.usuario_idusuario = $1
         AND p.ativo = TRUE`,
      [req.userId]
    )
    if (!profissionalResult.rows.length) {
      return res.status(404).json({ message: 'Perfil profissional não encontrado ou inativo.' })
    }

    const profissional = profissionalResult.rows[0]
    const dataResult = await pool.query(
      `SELECT TO_CHAR(
         COALESCE($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date),
         'YYYY-MM-DD'
       ) AS data`,
      [data]
    )
    const dataSelecionada = dataResult.rows[0].data

    const [agendaResult, resumoDiaResult, resumoMesResult, proximosResult] = await Promise.all([
      pool.query(
        `SELECT a.idagendamento,
                TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                TO_CHAR(a.horario, 'HH24:MI') AS horario,
                a.statusagendamento, a.cliente, a.cliente_email,
                c.telefone AS cliente_telefone,
                a.servico, a.duracao, a.preco,
                pagamento.statuspagamento, pagamento.metodo
         FROM public.vw_agendamentos_completos a
         JOIN public.cliente c ON c.idcliente = a.idcliente
         LEFT JOIN LATERAL (
           SELECT p.statuspagamento, p.metodo
           FROM public.pagamento p
           WHERE p.agendamento_idagendamento = a.idagendamento
           ORDER BY p.idpagamento DESC
           LIMIT 1
         ) pagamento ON TRUE
         WHERE a.idprofissional = $1
           AND a.dataagendamento = $2::date
         ORDER BY a.horario, a.idagendamento`,
        [profissional.idprofissional, dataSelecionada]
      ),
      pool.query(
        `SELECT COUNT(*)::integer AS total,
                COUNT(*) FILTER (WHERE statusagendamento = 'AGENDADO')::integer AS agendados,
                COUNT(*) FILTER (WHERE statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                COUNT(*) FILTER (WHERE statusagendamento = 'CANCELADO')::integer AS cancelados
         FROM public.vw_agendamentos_completos
         WHERE idprofissional = $1
           AND dataagendamento = $2::date`,
        [profissional.idprofissional, dataSelecionada]
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE statusagendamento <> 'CANCELADO')::integer AS atendimentos,
                COUNT(*) FILTER (WHERE statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                COUNT(DISTINCT idcliente) FILTER (WHERE statusagendamento <> 'CANCELADO')::integer AS clientes
         FROM public.vw_agendamentos_completos
         WHERE idprofissional = $1
           AND dataagendamento >= DATE_TRUNC('month', $2::date)::date
           AND dataagendamento < (DATE_TRUNC('month', $2::date) + INTERVAL '1 month')::date`,
        [profissional.idprofissional, dataSelecionada]
      ),
      pool.query(
        `SELECT a.idagendamento,
                TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                TO_CHAR(a.horario, 'HH24:MI') AS horario,
                a.cliente, a.servico, a.duracao
         FROM public.vw_agendamentos_completos a
         WHERE a.idprofissional = $1
           AND a.statusagendamento = 'AGENDADO'
           AND (a.dataagendamento + a.horario)
               >= CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
         ORDER BY a.dataagendamento, a.horario
         LIMIT 5`,
        [profissional.idprofissional]
      ),
    ])

    return res.status(200).json({
      data: dataSelecionada,
      profissional,
      resumo: {
        ...resumoDiaResult.rows[0],
        mes: resumoMesResult.rows[0],
      },
      agendamentos: agendaResult.rows,
      proximos: proximosResult.rows,
    })
  } catch (err) {
    console.error('Erro ao carregar o painel profissional:', err)
    return res.status(500).json({ message: 'Não foi possível carregar o painel profissional.' })
  }
}

async function concluirAdmin(req, res) {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Agendamento inválido.' })

  try {
    const result = await pool.query(
      `UPDATE public.agendamento
       SET statusagendamento = 'CONCLUIDO'
       FROM public.servico s
       WHERE agendamento.idagendamento = $1
         AND s.idservico = agendamento.servico_idservico
         AND agendamento.statusagendamento = 'AGENDADO'
         AND (agendamento.dataagendamento + agendamento.horario
              + (COALESCE(agendamento.duracao_snapshot, s.duracao) * INTERVAL '1 minute'))
             <= CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
       RETURNING agendamento.idagendamento, agendamento.statusagendamento`,
      [req.params.id]
    )
    if (result.rows.length) {
      return res.status(200).json({ message: 'Atendimento concluído.', ...result.rows[0] })
    }

    const existente = await pool.query(
      `SELECT a.statusagendamento,
              (a.dataagendamento + a.horario
                + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute'))
                <= CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS iniciado
       FROM public.agendamento a
       JOIN public.servico s ON s.idservico = a.servico_idservico
       WHERE a.idagendamento = $1`,
      [req.params.id]
    )
    if (!existente.rows.length) return res.status(404).json({ message: 'Agendamento não encontrado.' })
    if (existente.rows[0].statusagendamento !== 'AGENDADO') {
      return res.status(409).json({ message: 'Este agendamento não está ativo.' })
    }
    return res.status(409).json({ message: 'O atendimento ainda não terminou e não pode ser concluído.' })
  } catch (err) {
    console.error('Erro ao concluir agendamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = {
  criar,
  listarMeus,
  cancelar,
  listarAdmin,
  dashboardAdmin,
  dashboardProfissional,
  concluirAdmin,
}

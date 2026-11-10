const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { dataIsoValida, idValido } = require('../../utils/agendaUtils')
const { normalizarPaginacao, montarPaginacao } = require('../../utils/paginationUtils')

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
    registrarErro('Erro ao listar agendamentos para o administrador:', err)
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
    registrarErro('Erro ao carregar dashboard administrativo:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function concluirAdmin(req, res) {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Agendamento inválido.' })

  try {
    const existente = await pool.query(
      `SELECT a.statusagendamento,
              pagamento.statuspagamento,
              (a.dataagendamento + a.horario
                + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute'))
                <= CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS terminou,
              TO_CHAR(
                a.dataagendamento + a.horario
                  + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute'),
                'DD/MM/YYYY'
              ) AS data_termino,
              TO_CHAR(
                a.dataagendamento + a.horario
                  + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute'),
                'HH24:MI'
              ) AS horario_termino
       FROM public.agendamento a
       JOIN public.servico s ON s.idservico = a.servico_idservico
       LEFT JOIN LATERAL (
         SELECT p.statuspagamento
         FROM public.pagamento p
         WHERE p.agendamento_idagendamento = a.idagendamento
         ORDER BY p.idpagamento DESC
         LIMIT 1
       ) pagamento ON TRUE
       WHERE a.idagendamento = $1`,
      [req.params.id]
    )
    if (!existente.rows.length) return res.status(404).json({ message: 'Agendamento não encontrado.' })
    const agendamento = existente.rows[0]
    if (agendamento.statusagendamento !== 'AGENDADO') {
      return res.status(409).json({ message: 'Este agendamento não está ativo.' })
    }
    if (!agendamento.terminou) {
      return res.status(409).json({
        message: `Este atendimento ainda não terminou. Ele poderá ser concluído após ${agendamento.data_termino} às ${agendamento.horario_termino}.`,
        codigo: 'ATENDIMENTO_NAO_FINALIZADO',
      })
    }
    if (agendamento.statuspagamento !== 'CONFIRMADO') {
      return res.status(409).json({
        message: 'O pagamento deste atendimento ainda está pendente. Confirme o pagamento antes de concluí-lo.',
        codigo: 'PAGAMENTO_NAO_CONFIRMADO',
      })
    }

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
         AND (
           SELECT p.statuspagamento
           FROM public.pagamento p
           WHERE p.agendamento_idagendamento = agendamento.idagendamento
           ORDER BY p.idpagamento DESC
           LIMIT 1
         ) = 'CONFIRMADO'
       RETURNING agendamento.idagendamento, agendamento.statusagendamento`,
      [req.params.id]
    )
    if (result.rows.length) {
      return res.status(200).json({ message: 'Atendimento concluído.', ...result.rows[0] })
    }
    return res.status(409).json({
      message: 'Os dados deste atendimento foram alterados. Atualize a página e tente novamente.',
      codigo: 'AGENDAMENTO_ATUALIZADO',
    })
  } catch (err) {
    registrarErro('Erro ao concluir agendamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { listarAdmin, dashboardAdmin, concluirAdmin }

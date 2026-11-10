const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { dataIsoValida } = require('../../utils/agendaUtils')

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
    registrarErro('Erro ao carregar o painel profissional:', err)
    return res.status(500).json({ message: 'Não foi possível carregar o painel profissional.' })
  }
}

module.exports = { dashboardProfissional }

const pool = require('../../config/db')
const { HORA, atendimentoCabeNoExpediente } = require('../../utils/agendaUtils')

async function listarHorarios(req, res) {
  try {
    const result = await pool.query(
      `SELECT dia_semana,
              TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
              TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento,
              intervalo_ativo,
              TO_CHAR(hora_inicio_intervalo, 'HH24:MI') AS hora_inicio_intervalo,
              TO_CHAR(hora_fim_intervalo, 'HH24:MI') AS hora_fim_intervalo,
              ativo
       FROM public.horario_funcionamento
       ORDER BY CASE WHEN dia_semana = 0 THEN 7 ELSE dia_semana END`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar horários de funcionamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function salvarHorarios(req, res) {
  const { horarios } = req.body || {}

  if (!Array.isArray(horarios) || horarios.length !== 7) {
    return res.status(400).json({ message: 'Informe os horários dos sete dias da semana.' })
  }

  const dias = new Set()
  for (const horario of horarios) {
    if (!horario || typeof horario !== 'object' || Array.isArray(horario)) {
      return res.status(400).json({ message: 'Cada dia deve possuir uma configuração de horário válida.' })
    }
    const { dia_semana, hora_abertura, hora_fechamento, ativo,
      intervalo_ativo, hora_inicio_intervalo, hora_fim_intervalo } = horario
    if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6 || dias.has(dia_semana)) {
      return res.status(400).json({ message: 'Os dias da semana devem ser únicos e estar entre 0 e 6.' })
    }
    dias.add(dia_semana)

    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ message: 'O estado de funcionamento deve ser true ou false.' })
    }
    if (ativo && (!HORA.test(hora_abertura) || !HORA.test(hora_fechamento) || hora_abertura >= hora_fechamento)) {
      return res.status(400).json({ message: 'Em dias abertos, informe horários válidos e fechamento posterior à abertura.' })
    }
    if (typeof intervalo_ativo !== 'boolean') {
      return res.status(400).json({ message: 'O estado do intervalo deve ser true ou false.' })
    }
    if (intervalo_ativo && (!ativo
      || !HORA.test(hora_inicio_intervalo) || !HORA.test(hora_fim_intervalo)
      || hora_inicio_intervalo >= hora_fim_intervalo
      || hora_inicio_intervalo < hora_abertura || hora_fim_intervalo > hora_fechamento)) {
      return res.status(400).json({ message: 'O intervalo deve estar dentro do horário de funcionamento.' })
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda_global'), 0)")

    const agendamentosFuturos = await client.query(
      `SELECT a.idagendamento,
              EXTRACT(DOW FROM a.dataagendamento)::INTEGER AS dia_semana,
              TO_CHAR(a.dataagendamento, 'DD/MM/YYYY') AS data_formatada,
              TO_CHAR(a.horario, 'HH24:MI') AS horario,
              COALESCE(a.duracao_snapshot, s.duracao) AS duracao,
              f.modo_funcionamento,
              TO_CHAR(f.hora_abertura, 'HH24:MI') AS feriado_abertura,
              TO_CHAR(f.hora_fechamento, 'HH24:MI') AS feriado_fechamento
       FROM public.agendamento a
       JOIN public.servico s ON s.idservico = a.servico_idservico
       LEFT JOIN public.feriado f ON f.data = a.dataagendamento
       WHERE a.statusagendamento = 'AGENDADO'
         AND (a.dataagendamento + a.horario)
             > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
         AND NOT EXISTS (
           SELECT 1
           FROM public.horario_profissional hp
           WHERE hp.profissional_idprofissional = a.profissional_idprofissional
             AND hp.dia_semana = EXTRACT(DOW FROM a.dataagendamento)::INTEGER
         )
       ORDER BY a.dataagendamento, a.horario`
    )
    const horariosPorDia = new Map(horarios.map((horario) => [horario.dia_semana, horario]))
    const conflito = agendamentosFuturos.rows.find((agendamento) => {
      const regraSemanal = horariosPorDia.get(agendamento.dia_semana)
      const regraEfetiva = agendamento.modo_funcionamento === 'horario_especial'
        ? {
            ...regraSemanal,
            hora_abertura: agendamento.feriado_abertura,
            hora_fechamento: agendamento.feriado_fechamento,
          }
        : regraSemanal
      return !atendimentoCabeNoExpediente(
        agendamento.horario,
        agendamento.duracao,
        regraEfetiva
      )
    })
    if (conflito) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: `A alteração conflita com o agendamento de ${conflito.data_formatada} às ${conflito.horario}.`,
      })
    }

    for (const horario of horarios) {
      const abertura = horario.ativo ? horario.hora_abertura : null
      const fechamento = horario.ativo ? horario.hora_fechamento : null
      const intervaloAtivo = horario.ativo && horario.intervalo_ativo
      const inicioIntervalo = intervaloAtivo ? horario.hora_inicio_intervalo : null
      const fimIntervalo = intervaloAtivo ? horario.hora_fim_intervalo : null
      await client.query(
        `INSERT INTO public.horario_funcionamento
          (dia_semana, hora_abertura, hora_fechamento, ativo,
           intervalo_ativo, hora_inicio_intervalo, hora_fim_intervalo, atualizado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (dia_semana) DO UPDATE SET
           hora_abertura = EXCLUDED.hora_abertura,
           hora_fechamento = EXCLUDED.hora_fechamento,
           ativo = EXCLUDED.ativo,
           intervalo_ativo = EXCLUDED.intervalo_ativo,
           hora_inicio_intervalo = EXCLUDED.hora_inicio_intervalo,
           hora_fim_intervalo = EXCLUDED.hora_fim_intervalo,
           atualizado_em = NOW()`,
        [horario.dia_semana, abertura, fechamento, horario.ativo,
          intervaloAtivo, inicioIntervalo, fimIntervalo]
      )
    }
    await client.query('COMMIT')
    return listarHorarios(req, res)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao salvar horários de funcionamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { listarHorarios, salvarHorarios }

const pool = require('../../config/db')
const {
  HORA,
  atendimentoCabeNoExpediente,
  dataIsoValida,
  idValido,
} = require('../../utils/agendaUtils')

const TIPOS_AUSENCIA = new Set(['FOLGA', 'FERIAS', 'FERIADO'])

function validarHorarios(horarios) {
  if (!Array.isArray(horarios) || horarios.length !== 7) {
    return 'Informe os horários dos sete dias da semana.'
  }

  const dias = new Set()
  for (const horario of horarios) {
    if (!horario || typeof horario !== 'object' || Array.isArray(horario)) {
      return 'Cada dia deve possuir uma configuração de horário válida.'
    }
    const {
      dia_semana: diaSemana,
      hora_abertura: abertura,
      hora_fechamento: fechamento,
      ativo,
      intervalo_ativo: intervaloAtivo,
      hora_inicio_intervalo: inicioIntervalo,
      hora_fim_intervalo: fimIntervalo,
    } = horario

    if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6 || dias.has(diaSemana)) {
      return 'Os dias da semana devem ser únicos e estar entre 0 e 6.'
    }
    dias.add(diaSemana)

    if (typeof ativo !== 'boolean' || typeof intervaloAtivo !== 'boolean') {
      return 'Os estados de funcionamento e intervalo devem ser verdadeiros ou falsos.'
    }
    if (ativo && (!HORA.test(abertura) || !HORA.test(fechamento) || abertura >= fechamento)) {
      return 'Em dias trabalhados, informe abertura e fechamento válidos.'
    }
    if (intervaloAtivo && (!ativo || !HORA.test(inicioIntervalo) || !HORA.test(fimIntervalo)
      || inicioIntervalo >= fimIntervalo || inicioIntervalo < abertura || fimIntervalo > fechamento)) {
      return 'O intervalo deve estar dentro do expediente do profissional.'
    }
  }

  return null
}

async function profissionalExiste(client, profissionalId) {
  const result = await client.query(
    'SELECT idprofissional FROM public.profissional WHERE idprofissional = $1 AND ativo = TRUE',
    [profissionalId]
  )
  return result.rows.length > 0
}

async function listarHorarios(req, res) {
  const profissionalId = req.params.profissionalId
  if (!idValido(profissionalId)) return res.status(400).json({ message: 'Profissional inválido.' })

  try {
    if (!await profissionalExiste(pool, profissionalId)) {
      return res.status(404).json({ message: 'Profissional não encontrado ou inativo.' })
    }

    const result = await pool.query(
      `SELECT dias.dia_semana,
              TO_CHAR(COALESCE(hp.hora_abertura, hf.hora_abertura), 'HH24:MI') AS hora_abertura,
              TO_CHAR(COALESCE(hp.hora_fechamento, hf.hora_fechamento), 'HH24:MI') AS hora_fechamento,
              COALESCE(hp.intervalo_ativo, hf.intervalo_ativo, FALSE) AS intervalo_ativo,
              TO_CHAR(COALESCE(hp.hora_inicio_intervalo, hf.hora_inicio_intervalo), 'HH24:MI') AS hora_inicio_intervalo,
              TO_CHAR(COALESCE(hp.hora_fim_intervalo, hf.hora_fim_intervalo), 'HH24:MI') AS hora_fim_intervalo,
              COALESCE(hp.ativo, hf.ativo, FALSE) AS ativo,
              hp.idhorario_profissional IS NOT NULL AS personalizado
       FROM generate_series(0, 6) AS dias(dia_semana)
       LEFT JOIN public.horario_profissional hp
         ON hp.profissional_idprofissional = $1
        AND hp.dia_semana = dias.dia_semana
       LEFT JOIN public.horario_funcionamento hf
         ON hf.dia_semana = dias.dia_semana
       ORDER BY CASE WHEN dias.dia_semana = 0 THEN 7 ELSE dias.dia_semana END`,
      [profissionalId]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar horários do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function salvarHorarios(req, res) {
  const profissionalId = req.params.profissionalId
  if (!idValido(profissionalId)) return res.status(400).json({ message: 'Profissional inválido.' })

  const erroValidacao = validarHorarios(req.body?.horarios)
  if (erroValidacao) return res.status(400).json({ message: erroValidacao })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (!await profissionalExiste(client, profissionalId)) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Profissional não encontrado ou inativo.' })
    }

    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('agenda_global'), 0)")
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('agenda_profissional'), $1::integer)",
      [profissionalId]
    )

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
       WHERE a.profissional_idprofissional = $1
         AND a.statusagendamento = 'AGENDADO'
         AND (a.dataagendamento + a.horario)
             > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
       ORDER BY a.dataagendamento, a.horario`,
      [profissionalId]
    )
    const horariosPorDia = new Map(req.body.horarios.map((horario) => [horario.dia_semana, horario]))
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

    for (const horario of req.body.horarios) {
      const abertura = horario.ativo ? horario.hora_abertura : null
      const fechamento = horario.ativo ? horario.hora_fechamento : null
      const intervaloAtivo = horario.ativo && horario.intervalo_ativo
      await client.query(
        `INSERT INTO public.horario_profissional
          (profissional_idprofissional, dia_semana, hora_abertura, hora_fechamento,
           intervalo_ativo, hora_inicio_intervalo, hora_fim_intervalo, ativo, atualizado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (profissional_idprofissional, dia_semana) DO UPDATE SET
           hora_abertura = EXCLUDED.hora_abertura,
           hora_fechamento = EXCLUDED.hora_fechamento,
           intervalo_ativo = EXCLUDED.intervalo_ativo,
           hora_inicio_intervalo = EXCLUDED.hora_inicio_intervalo,
           hora_fim_intervalo = EXCLUDED.hora_fim_intervalo,
           ativo = EXCLUDED.ativo,
           atualizado_em = NOW()`,
        [profissionalId, horario.dia_semana, abertura, fechamento, intervaloAtivo,
          intervaloAtivo ? horario.hora_inicio_intervalo : null,
          intervaloAtivo ? horario.hora_fim_intervalo : null, horario.ativo]
      )
    }
    await client.query('COMMIT')
    return listarHorarios(req, res)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao salvar horários do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function listarAusencias(req, res) {
  const profissionalId = req.params.profissionalId
  if (!idValido(profissionalId)) return res.status(400).json({ message: 'Profissional inválido.' })

  try {
    const result = await pool.query(
      `SELECT iddisponibilidade, tipo,
              TO_CHAR(datainicio, 'YYYY-MM-DD') AS datainicio,
              TO_CHAR(datafim, 'YYYY-MM-DD') AS datafim,
              descricao
       FROM public.disponibilidade
       WHERE profissional_idprofissional = $1
       ORDER BY datainicio DESC, iddisponibilidade DESC`,
      [profissionalId]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar ausências do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function criarAusencia(req, res) {
  const profissionalId = req.params.profissionalId
  const { tipo, datainicio, datafim, descricao } = req.body || {}
  if (!idValido(profissionalId)) return res.status(400).json({ message: 'Profissional inválido.' })
  if (!TIPOS_AUSENCIA.has(tipo) || !dataIsoValida(datainicio) || !dataIsoValida(datafim) || datafim < datainicio) {
    return res.status(400).json({ message: 'Informe tipo e período de ausência válidos.' })
  }
  if (descricao !== undefined && (typeof descricao !== 'string' || descricao.trim().length > 255)) {
    return res.status(400).json({ message: 'A descrição deve possuir no máximo 255 caracteres.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (!await profissionalExiste(client, profissionalId)) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Profissional não encontrado ou inativo.' })
    }

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('agenda_profissional'), $1::integer)",
      [profissionalId]
    )

    const agendamentos = await client.query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM public.agendamento
       WHERE profissional_idprofissional = $1
         AND dataagendamento BETWEEN $2::date AND $3::date
         AND statusagendamento = 'AGENDADO'`,
      [profissionalId, datainicio, datafim]
    )
    if (agendamentos.rows[0].total > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: `O profissional possui ${agendamentos.rows[0].total} agendamento(s) ativo(s) neste período.`,
      })
    }

    const result = await client.query(
      `INSERT INTO public.disponibilidade
        (profissional_idprofissional, tipo, datainicio, datafim, descricao)
       VALUES ($1, $2, $3::date, $4::date, $5)
       RETURNING iddisponibilidade, tipo,
                 TO_CHAR(datainicio, 'YYYY-MM-DD') AS datainicio,
                 TO_CHAR(datafim, 'YYYY-MM-DD') AS datafim, descricao`,
      [profissionalId, tipo, datainicio, datafim, descricao?.trim() || null]
    )
    await client.query('COMMIT')
    return res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao criar ausência do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function deletarAusencia(req, res) {
  const { profissionalId, ausenciaId } = req.params
  if (!idValido(profissionalId) || !idValido(ausenciaId)) {
    return res.status(400).json({ message: 'Profissional ou ausência inválida.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('agenda_profissional'), $1::integer)",
      [profissionalId]
    )
    const result = await client.query(
      `DELETE FROM public.disponibilidade
       WHERE iddisponibilidade = $1 AND profissional_idprofissional = $2
       RETURNING iddisponibilidade`,
      [ausenciaId, profissionalId]
    )
    if (!result.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Ausência não encontrada.' })
    }
    await client.query('COMMIT')
    return res.status(200).json({ message: 'Ausência removida.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao remover ausência do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { listarHorarios, salvarHorarios, listarAusencias, criarAusencia, deletarAusencia }

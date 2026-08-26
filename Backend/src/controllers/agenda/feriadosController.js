const pool = require('../../config/db')
const {
  dataIsoValida,
  HORA,
  MODOS_FERIADO,
  atendimentoCabeNoExpediente,
  idValido,
} = require('../../utils/agendaUtils')

async function encontrarConflito(client, data, modo, aberturaEspecial, fechamentoEspecial) {
  const result = await client.query(
    `SELECT a.idagendamento,
            TO_CHAR(a.horario, 'HH24:MI') AS horario,
            COALESCE(a.duracao_snapshot, s.duracao) AS duracao,
            COALESCE(hp.ativo, hf.ativo, FALSE) AS ativo,
            TO_CHAR(COALESCE(hp.hora_abertura, hf.hora_abertura), 'HH24:MI') AS hora_abertura,
            TO_CHAR(COALESCE(hp.hora_fechamento, hf.hora_fechamento), 'HH24:MI') AS hora_fechamento,
            COALESCE(hp.intervalo_ativo, hf.intervalo_ativo, FALSE) AS intervalo_ativo,
            TO_CHAR(COALESCE(hp.hora_inicio_intervalo, hf.hora_inicio_intervalo), 'HH24:MI') AS hora_inicio_intervalo,
            TO_CHAR(COALESCE(hp.hora_fim_intervalo, hf.hora_fim_intervalo), 'HH24:MI') AS hora_fim_intervalo
     FROM public.agendamento a
     JOIN public.servico s ON s.idservico = a.servico_idservico
     LEFT JOIN public.horario_profissional hp
       ON hp.profissional_idprofissional = a.profissional_idprofissional
      AND hp.dia_semana = EXTRACT(DOW FROM a.dataagendamento)::INTEGER
     LEFT JOIN public.horario_funcionamento hf
       ON hf.dia_semana = EXTRACT(DOW FROM a.dataagendamento)::INTEGER
     WHERE a.dataagendamento = $1::date
       AND a.statusagendamento = 'AGENDADO'
     ORDER BY a.horario`,
    [data]
  )

  return result.rows.find((agendamento) => {
    if (modo === 'fechado') return true
    const regra = {
      ativo: agendamento.ativo,
      hora_abertura: modo === 'horario_especial' ? aberturaEspecial : agendamento.hora_abertura,
      hora_fechamento: modo === 'horario_especial' ? fechamentoEspecial : agendamento.hora_fechamento,
      intervalo_ativo: agendamento.intervalo_ativo,
      hora_inicio_intervalo: agendamento.hora_inicio_intervalo,
      hora_fim_intervalo: agendamento.hora_fim_intervalo,
    }
    return !atendimentoCabeNoExpediente(agendamento.horario, agendamento.duracao, regra)
  })
}

async function listarFeriados(req, res) {
  const ano = req.query.ano === undefined ? new Date().getFullYear() : Number(req.query.ano)
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return res.status(400).json({ message: 'Ano inválido.' })
  }

  try {
    const result = await pool.query(
      `SELECT idferiado, TO_CHAR(data, 'YYYY-MM-DD') AS data, nome, origem,
              modo_funcionamento,
              TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
              TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento
       FROM public.feriado
       WHERE EXTRACT(YEAR FROM data) = $1
       ORDER BY data`,
      [ano]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar feriados:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function importarFeriados(req, res) {
  const ano = Number(req.params.ano)
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return res.status(400).json({ message: 'Ano inválido.' })
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`BrasilAPI respondeu com status ${response.status}`)
    const feriados = await response.json()

    let client
    try {
      client = await pool.connect()
    } catch (err) {
      err.origemImportacao = 'banco'
      throw err
    }
    try {
      await client.query('BEGIN')
      await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda_global'), 0)")
      for (const feriado of feriados) {
        if (!dataIsoValida(feriado.date) || typeof feriado.name !== 'string') continue
        await client.query(
          `INSERT INTO public.feriado (data, nome, origem, modo_funcionamento)
           VALUES (
             $1, $2, 'api',
             CASE WHEN EXISTS (
               SELECT 1 FROM public.agendamento
               WHERE dataagendamento = $1::date AND statusagendamento = 'AGENDADO'
             ) THEN 'horario_normal' ELSE 'fechado' END
           )
           ON CONFLICT (data) DO UPDATE SET
             nome = EXCLUDED.nome,
             origem = CASE WHEN public.feriado.origem = 'manual' THEN 'manual' ELSE 'api' END,
             atualizado_em = NOW()`,
          [feriado.date, feriado.name]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      err.origemImportacao = 'banco'
      throw err
    } finally {
      client.release()
    }

    return listarFeriados({ ...req, query: { ano } }, res)
  } catch (err) {
    console.error('Erro ao importar feriados:', err)
    if (err.origemImportacao === 'banco') {
      return res.status(500).json({ message: 'Erro interno no servidor.' })
    }
    return res.status(502).json({ message: 'Não foi possível consultar a BrasilAPI agora.' })
  }
}

async function atualizarFeriado(req, res) {
  const { id } = req.params
  const { modo_funcionamento, hora_abertura, hora_fechamento } = req.body || {}

  if (!idValido(id)) return res.status(400).json({ message: 'ID inválido.' })
  if (!MODOS_FERIADO.includes(modo_funcionamento)) {
    return res.status(400).json({ message: 'Modo de funcionamento inválido.' })
  }
  if (modo_funcionamento === 'horario_especial'
      && (!HORA.test(hora_abertura) || !HORA.test(hora_fechamento) || hora_abertura >= hora_fechamento)) {
    return res.status(400).json({ message: 'Informe um horário especial válido.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda_global'), 0)")
    const existente = await client.query(
      `SELECT idferiado, TO_CHAR(data, 'YYYY-MM-DD') AS data
       FROM public.feriado
       WHERE idferiado = $1
       FOR UPDATE`,
      [id]
    )
    if (!existente.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Feriado não encontrado.' })
    }

    const especial = modo_funcionamento === 'horario_especial'
    const conflito = await encontrarConflito(
      client,
      existente.rows[0].data,
      modo_funcionamento,
      especial ? hora_abertura : null,
      especial ? hora_fechamento : null
    )
    if (conflito) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: `A alteração conflita com o agendamento das ${conflito.horario}.`,
      })
    }

    const result = await client.query(
      `UPDATE public.feriado
       SET modo_funcionamento = $1,
           hora_abertura = $2,
           hora_fechamento = $3,
           atualizado_em = NOW()
       WHERE idferiado = $4
       RETURNING idferiado, TO_CHAR(data, 'YYYY-MM-DD') AS data, nome, origem,
                 modo_funcionamento,
                 TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
                 TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento`,
      [modo_funcionamento, especial ? hora_abertura : null, especial ? hora_fechamento : null, id]
    )
    await client.query('COMMIT')
    return res.status(200).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao atualizar feriado:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { listarFeriados, importarFeriados, atualizarFeriado }

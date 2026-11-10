const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { dataIsoValida, idValido } = require('../../utils/agendaUtils')

const TIPOS_AUSENCIA = new Set(['FOLGA', 'FERIAS', 'FERIADO'])

async function profissionalExiste(client, profissionalId) {
  const result = await client.query(
    'SELECT idprofissional FROM public.profissional WHERE idprofissional = $1 AND ativo = TRUE',
    [profissionalId]
  )
  return result.rows.length > 0
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
    registrarErro('Erro ao listar ausências do profissional:', err)
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
    registrarErro('Erro ao criar ausência do profissional:', err)
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
    registrarErro('Erro ao remover ausência do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { listarAusencias, criarAusencia, deletarAusencia }

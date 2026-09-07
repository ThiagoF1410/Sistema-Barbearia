const pool = require('../../config/db')
const { dataIsoValida, idValido } = require('../../utils/agendaUtils')

async function listar(req, res) {
  try {
    const result = await pool.query(
      `SELECT ag.idagenda, TO_CHAR(ag.data, 'YYYY-MM-DD') AS data, ag.disponivel,
              COUNT(a.idagendamento)::INTEGER AS total_agendamentos,
              COUNT(a.idagendamento) FILTER (WHERE a.statusagendamento = 'AGENDADO')::INTEGER AS total_ativos
       FROM public.agenda ag
       LEFT JOIN public.agendamento a ON a.agenda_idagenda = ag.idagenda
       GROUP BY ag.idagenda, ag.data, ag.disponivel
       ORDER BY ag.data ASC`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar agenda:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

// GET  somente datas disponíveis (para o cliente agendar)
async function listarDisponiveis(req, res) {
  try {
    const result = await pool.query(
      `SELECT idagenda, data
       FROM public.agenda
       WHERE disponivel = TRUE
         AND data >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
       ORDER BY data ASC`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar datas disponíveis:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

// POST  admin adiciona uma data na agenda
async function criar(req, res) {
  const { data, disponivel } = req.body || {}

  if (!dataIsoValida(data)) {
    return res.status(400).json({ message: 'Informe uma data válida no formato AAAA-MM-DD.' })
  }
  if (disponivel !== undefined && typeof disponivel !== 'boolean') {
    return res.status(400).json({ message: 'O campo "disponível" deve ser verdadeiro ou falso.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda_global'), 0)")
    const result = await client.query(
      `INSERT INTO public.agenda (data, disponivel)
       SELECT $1::date, $2
       WHERE $1::date >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
       RETURNING *`,
      [data, disponivel !== undefined ? disponivel : true]
    )
    if (result.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Não é permitido cadastrar uma data passada.' })
    }
    await client.query('COMMIT')
    return res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Esta data já existe na agenda.' })
    }
    console.error('Erro ao criar data na agenda:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

// PATCH  admin bloqueia ou libera uma data
async function alterarDisponibilidade(req, res) {
  const { id } = req.params
  const { disponivel } = req.body || {}

  if (!idValido(id)) return res.status(400).json({ message: 'ID inválido.' })
  if (typeof disponivel !== 'boolean') {
    return res.status(400).json({ message: 'O campo "disponível" é obrigatório e deve ser verdadeiro ou falso.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda_global'), 0)")
    const existente = await client.query(
      `SELECT idagenda
       FROM public.agenda
       WHERE idagenda = $1
       FOR UPDATE`,
      [id]
    )
    if (!existente.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Data não encontrada.' })
    }

    if (!disponivel) {
      const vinculados = await client.query(
        `SELECT COUNT(*)::INTEGER AS ativos
         FROM public.agendamento
         WHERE agenda_idagenda = $1 AND statusagendamento = 'AGENDADO'`,
        [id]
      )
      if (vinculados.rows[0].ativos > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          message: `Esta data possui ${vinculados.rows[0].ativos} agendamento(s) ativo(s) e não pode ser bloqueada.`,
        })
      }
    }

    const result = await client.query(
      `UPDATE public.agenda
       SET disponivel = $1
       WHERE idagenda = $2
       RETURNING *`,
      [disponivel, id]
    )
    await client.query('COMMIT')
    return res.status(200).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao alterar disponibilidade:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

// DELETE  admin remove uma data
async function deletar(req, res) {
  const { id } = req.params
  if (!idValido(id)) return res.status(400).json({ message: 'ID inválido.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda_global'), 0)")
    const existente = await client.query(
      `SELECT idagenda
       FROM public.agenda
       WHERE idagenda = $1
       FOR UPDATE`,
      [id]
    )
    if (!existente.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Data não encontrada.' })
    }

    const vinculados = await client.query(
      `SELECT COUNT(*) FILTER (WHERE statusagendamento = 'AGENDADO')::INTEGER AS ativos
       FROM public.agendamento WHERE agenda_idagenda = $1`,
      [id]
    )
    if (vinculados.rows[0].ativos > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: `Esta data possui ${vinculados.rows[0].ativos} agendamento(s) ativo(s) e não pode ser removida.`,
      })
    }
    await client.query(
      'DELETE FROM public.agenda WHERE idagenda=$1 RETURNING idagenda',
      [id]
    )
    await client.query('COMMIT')
    return res.status(200).json({ message: 'Data removida da agenda.' })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23503') {
      return res.status(409).json({ message: 'Execute a migração 008 para remover a data preservando o histórico cancelado.' })
    }
    console.error('Erro ao deletar data:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { listar, listarDisponiveis, criar, alterarDisponibilidade, deletar }

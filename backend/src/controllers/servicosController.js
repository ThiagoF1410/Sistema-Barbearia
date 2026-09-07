const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')

function validarServico({ nome, tipo, duracao, preco }) {
  const duracaoNumero = Number(duracao)
  const precoNumero = Number(preco)
  if (typeof nome !== 'string' || !nome.trim() || !['servico', 'produto'].includes(tipo)) return false
  return Number.isInteger(duracaoNumero) && duracaoNumero > 0
    && Number.isFinite(precoNumero) && precoNumero >= 0
}

// GET qualquer usuário autenticado
async function listar(req, res) {
  try {
    const result = await pool.query(
      `SELECT idservico, nome, tipo, duracao, preco, descricao
       FROM public.servico
       ORDER BY tipo, nome`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar serviços:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function buscarPorId(req, res) {
  const { id } = req.params
  if (!idValido(id)) return res.status(400).json({ message: 'ID do serviço inválido.' })
  try {
    const result = await pool.query(
      'SELECT * FROM public.servico WHERE idservico = $1',
      [id]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Serviço não encontrado.' })
    return res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('Erro ao buscar serviço:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

// POST somente admin
async function criar(req, res) {
  const { nome, tipo, duracao, preco, descricao } = req.body || {}

  if (!validarServico({ nome, tipo, duracao, preco })) {
    return res.status(400).json({ message: 'Informe nome, tipo válido, duração positiva e preço não negativo.' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.servico (nome, tipo, duracao, preco, descricao)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nome.trim(), tipo, Number(duracao), Number(preco), descricao || null]
    )
    return res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Erro ao criar serviço:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

// PUT somente admin
async function atualizar(req, res) {
  const { id } = req.params
  const { nome, tipo, duracao, preco, descricao } = req.body || {}

  if (!idValido(id)) return res.status(400).json({ message: 'ID do serviço inválido.' })

  if (!validarServico({ nome, tipo, duracao, preco })) {
    return res.status(400).json({ message: 'Informe nome, tipo válido, duração positiva e preço não negativo.' })
  }

  try {
    const result = await pool.query(
      `UPDATE public.servico
       SET nome=$1, tipo=$2, duracao=$3, preco=$4, descricao=$5
       WHERE idservico=$6
       RETURNING *`,
      [nome.trim(), tipo, Number(duracao), Number(preco), descricao || null, id]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Serviço não encontrado.' })
    return res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('Erro ao atualizar serviço:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

// DELETE  somente admin
async function deletar(req, res) {
  const { id } = req.params
  if (!idValido(id)) return res.status(400).json({ message: 'ID do serviço inválido.' })
  try {
    const result = await pool.query(
      'DELETE FROM public.servico WHERE idservico=$1 RETURNING idservico',
      [id]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Serviço não encontrado.' })
    return res.status(200).json({ message: 'Serviço removido com sucesso.' })
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ message: 'Este serviço possui registros vinculados e não pode ser removido.' })
    }
    console.error('Erro ao deletar serviço:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, deletar }

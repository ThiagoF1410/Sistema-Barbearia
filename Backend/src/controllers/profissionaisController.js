const pool = require('../config/db')

async function listar(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.idprofissional, u.nome, p.especialidade
       FROM public.profissional p
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       WHERE p.ativo = TRUE
       ORDER BY u.nome`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar profissionais:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { listar }

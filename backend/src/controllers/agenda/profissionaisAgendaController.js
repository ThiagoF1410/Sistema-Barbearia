const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { listarHorarios, salvarHorarios } = require('./profissionaisHorariosController')
const {
  listarAusencias,
  criarAusencia,
  deletarAusencia,
} = require('./profissionaisAusenciasController')

async function executarParaProfissionalAutenticado(req, res, operacao) {
  try {
    const result = await pool.query(
      `SELECT idprofissional
       FROM public.profissional
       WHERE usuario_idusuario = $1
         AND ativo = TRUE`,
      [req.userId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Perfil profissional não encontrado ou inativo.' })
    }
    req.params.profissionalId = String(result.rows[0].idprofissional)
    return operacao(req, res)
  } catch (err) {
    registrarErro('Erro ao identificar o profissional autenticado:', err)
    return res.status(500).json({ message: 'Não foi possível identificar o perfil profissional.' })
  }
}

const listarMeusHorarios = (req, res) => executarParaProfissionalAutenticado(req, res, listarHorarios)
const listarMinhasAusencias = (req, res) => executarParaProfissionalAutenticado(req, res, listarAusencias)

module.exports = {
  listarHorarios,
  salvarHorarios,
  listarAusencias,
  criarAusencia,
  deletarAusencia,
  listarMeusHorarios,
  listarMinhasAusencias,
}

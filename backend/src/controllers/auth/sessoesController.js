const { registrarErro } = require('../../utils/logger')
const {
  renovarSessao,
  encerrarSessao,
} = require('../../services/sessaoAutenticacaoService')

async function refresh(req, res) {
  try {
    const autenticacao = await renovarSessao(req, res)
    if (!autenticacao) {
      return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' })
    }
    return res.status(200).json(autenticacao)
  } catch (err) {
    registrarErro('Erro ao renovar sessão:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function logout(req, res) {
  try {
    await encerrarSessao(req, res)
    return res.status(200).json({ message: 'Sessão encerrada com segurança.' })
  } catch (err) {
    registrarErro('Erro ao encerrar sessão:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { refresh, logout }

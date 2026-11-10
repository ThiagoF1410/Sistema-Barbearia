const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { verifyToken } = require('../utils/authUtils')
const { sessaoAindaValida } = require('../services/sessaoAutenticacaoService')

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não informado.' })
  }

  const token = authHeader.split(' ')[1]

  let decoded
  try {
    decoded = verifyToken(token)
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' })
  }

  if (!Number.isInteger(decoded.id) || decoded.id <= 0
      || !Number.isInteger(decoded.tokenVersion)
      || !Number.isInteger(decoded.sid) || decoded.sid <= 0) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' })
  }

  try {
    const result = await pool.query(
      `SELECT u.token_version, s.idsessao, s.perfil,
              s.criada_em, s.ultima_atividade_em, s.expira_em, s.revogada_em,
              CASE
                WHEN a.idadministrador IS NOT NULL THEN 'admin'
                WHEN p.idprofissional IS NOT NULL AND p.ativo = TRUE THEN 'profissional'
                WHEN c.idcliente IS NOT NULL THEN 'cliente'
                ELSE NULL
              END AS role
       FROM public.usuario u
       JOIN public.sessao_autenticacao s
         ON s.usuario_idusuario = u.idusuario
        AND s.idsessao = $2
       LEFT JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
       LEFT JOIN public.profissional p ON p.usuario_idusuario = u.idusuario
       LEFT JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
       WHERE u.idusuario = $1`,
      [decoded.id, decoded.sid]
    )

    const usuario = result.rows[0]
    if (!usuario?.role
        || decoded.tokenVersion !== usuario.token_version
        || usuario.perfil !== usuario.role
        || !sessaoAindaValida(usuario)) {
      return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' })
    }

    await pool.query(
      `UPDATE public.sessao_autenticacao
       SET ultima_atividade_em = NOW()
       WHERE idsessao = $1
         AND ultima_atividade_em < NOW() - INTERVAL '5 minutes'`,
      [decoded.sid]
    )

    req.userId = decoded.id
    req.userRole = usuario.role
    req.sessionId = decoded.sid
    return next()
  } catch (err) {
    registrarErro('Erro ao validar sessão:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

function roleGuard(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Acesso não autorizado para esse tipo de perfil.' })
    }
    next()
  }
}

module.exports = { authMiddleware, roleGuard }

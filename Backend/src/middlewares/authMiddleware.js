<<<<<<< HEAD:Backend/src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não informado.' })
  }

  const token = authHeader.split(' ')[1]

  console.log('Token recebido:', token)
  console.log('JWT_SECRET:', process.env.JWT_SECRET)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId   = decoded.id
    req.userRole = decoded.role
    next()
  } catch (err) {
    console.error('Erro JWT:', err.message)
    return res.status(401).json({ message: 'Token inválido ou expirado.' })
  }
}

module.exports = authMiddleware
=======
const jwt = require('jsonwebtoken')
const pool = require('../config/db')

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não informado.' })
  }

  const token = authHeader.split(' ')[1]

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' })
  }

  try {
    const result = await pool.query(
      `SELECT u.token_version,
              CASE
                WHEN a.idadministrador IS NOT NULL THEN 'admin'
                WHEN p.idprofissional IS NOT NULL THEN 'profissional'
                WHEN c.idcliente IS NOT NULL THEN 'cliente'
                ELSE NULL
              END AS role
       FROM public.usuario u
       LEFT JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
       LEFT JOIN public.profissional p ON p.usuario_idusuario = u.idusuario
       LEFT JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
       WHERE u.idusuario = $1`,
      [decoded.id]
    )

    const usuario = result.rows[0]
    if (!usuario?.role || decoded.tokenVersion !== usuario.token_version) {
      return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' })
    }

    req.userId = decoded.id
    req.userRole = usuario.role
    return next()
  } catch (err) {
    console.error('Erro ao validar sessão:', err)
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
>>>>>>> fd3eb50 (Commit Projeto):backend/src/middlewares/authMiddleware.js

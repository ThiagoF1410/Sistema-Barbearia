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
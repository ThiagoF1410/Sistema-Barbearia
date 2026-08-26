const jwt = require('jsonwebtoken')

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function resolveRole(client, idusuario) {
  const admin = await client.query(
    'SELECT idadministrador FROM public.administrador WHERE usuario_idusuario = $1',
    [idusuario]
  )
  if (admin.rows.length > 0) return 'admin'

  const prof = await client.query(
    'SELECT idprofissional FROM public.profissional WHERE usuario_idusuario = $1',
    [idusuario]
  )
  if (prof.rows.length > 0) return 'profissional'

  return 'cliente'
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

module.exports = { resolveRole, signToken, normalizarEmail, emailValido }

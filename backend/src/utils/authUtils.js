const jwt = require('jsonwebtoken')

const JWT_ALGORITHM = 'HS256'
const JWT_ISSUER = 'rei-da-navalha-api'
const JWT_AUDIENCE = 'rei-da-navalha-web'
const BCRYPT_MAX_BYTES = 72

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function senhaValida(password) {
  return typeof password === 'string'
    && password.length >= 8
    && password.length <= BCRYPT_MAX_BYTES
    && Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_BYTES
    && /\p{Lu}/u.test(password)
    && /\p{Ll}/u.test(password)
    && /\p{N}/u.test(password)
    && /[^\p{L}\p{N}\s]/u.test(password)
}

async function resolveRole(client, idusuario) {
  const admin = await client.query(
    'SELECT idadministrador FROM public.administrador WHERE usuario_idusuario = $1',
    [idusuario]
  )
  if (admin.rows.length > 0) return 'admin'

  const prof = await client.query(
    'SELECT idprofissional, ativo FROM public.profissional WHERE usuario_idusuario = $1',
    [idusuario]
  )
  if (prof.rows.length > 0) return prof.rows[0].ativo ? 'profissional' : 'profissional_inativo'

  const cliente = await client.query(
    'SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1',
    [idusuario]
  )
  if (cliente.rows.length > 0) return 'cliente'

  return null
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  })
}

module.exports = { resolveRole, signToken, verifyToken, normalizarEmail, emailValido, senhaValida }

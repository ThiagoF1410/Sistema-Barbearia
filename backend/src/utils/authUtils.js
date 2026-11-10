const jwt = require('jsonwebtoken')

const JWT_ALGORITHM = 'HS256'
const JWT_ISSUER = 'rei-da-navalha-api'
const JWT_AUDIENCE = 'rei-da-navalha-web'
const PASSWORD_MIN_LENGTH = 12
const BCRYPT_MAX_BYTES = 72
const SENHA_REQUISITOS_MENSAGEM = 'A senha deve ter entre 12 e 72 caracteres, sem espaços ou acentos, atender pelo menos 3 de 4 grupos (maiúscula, minúscula, número e caractere especial) e não pode ser uma senha comum.'

const SENHAS_COMUNS = new Set([
  '123456', '12345678', '123456789', '1234567890', '123123', '111111',
  'password', 'password1', 'password123', 'senha', 'senha123', 'senha1234',
  'senha12345', 'admin', 'admin123', 'administrador', 'qwerty', 'qwerty123',
  'abc123', 'abcdef', 'letmein', 'welcome', 'iloveyou', 'usuario', 'user123',
])

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizarComparacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function senhaValida(password) {
  if (typeof password !== 'string'
    || password.length < PASSWORD_MIN_LENGTH
    || password.length > BCRYPT_MAX_BYTES
    || Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES
    || !/^[\x21-\x7E]+$/.test(password)) {
    return false
  }

  const gruposAtendidos = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  if (gruposAtendidos < 3) return false

  const normalizada = normalizarComparacao(password)
  if (SENHAS_COMUNS.has(normalizada)) return false
  return true
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
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  })
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  })
}

module.exports = {
  BCRYPT_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  SENHA_REQUISITOS_MENSAGEM,
  resolveRole,
  signToken,
  verifyToken,
  normalizarEmail,
  emailValido,
  senhaValida,
}

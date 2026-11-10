export const PASSWORD_BASIC_REQUIREMENTS = [
  { id: 'length', label: 'Entre 12 e 72 caracteres' },
  { id: 'allowed', label: 'Sem espaços, acentos ou emojis' },
  { id: 'notCommon', label: 'Não é uma senha comum' },
]

export const PASSWORD_GROUP_REQUIREMENTS = [
  { id: 'uppercase', label: 'Uma letra maiúscula' },
  { id: 'lowercase', label: 'Uma letra minúscula' },
  { id: 'number', label: 'Um número' },
  { id: 'special', label: 'Um caractere especial' },
]

const COMMON_PASSWORDS = new Set([
  '123456', '12345678', '123456789', '1234567890', '123123', '111111',
  'password', 'password1', 'password123', 'senha', 'senha123', 'senha1234',
  'senha12345', 'admin', 'admin123', 'administrador', 'qwerty', 'qwerty123',
  'abc123', 'abcdef', 'letmein', 'welcome', 'iloveyou', 'usuario', 'user123',
])

function normalizarComparacao(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function analisarSenha(password = '') {
  const normalizada = normalizarComparacao(password)
  const caracteresPermitidos = password.match(/[\x21-\x7E]/g)?.join('') || ''
  const caracteres = [...password]
  const temEspaco = /\s/.test(password)
  const temAcento = caracteres.some((caractere) => (
    /\p{L}/u.test(caractere)
    && caractere.normalize('NFD') !== caractere.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  ))
  const temCaractereNaoSuportado = caracteres.some((caractere) => (
    !/[\x21-\x7E]/.test(caractere)
    && !/\s/.test(caractere)
    && !(/\p{L}/u.test(caractere)
      && caractere.normalize('NFD') !== caractere.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  ))
  const errosCaracteres = [
    temEspaco && 'Espaços não são permitidos na senha.',
    temAcento && 'Letras com acento não são permitidas. Use letras sem acento.',
    temCaractereNaoSuportado && 'Emojis e caracteres não suportados não são permitidos.',
  ].filter(Boolean)
  const requisitos = {
    length: caracteresPermitidos.length >= 12 && caracteresPermitidos.length <= 72,
    allowed: password.length > 0 && /^[\x21-\x7E]+$/.test(password),
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(normalizada),
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9\s]/.test(password),
  }

  const gruposAtendidos = PASSWORD_GROUP_REQUIREMENTS.filter((item) => requisitos[item.id]).length
  const basicosAtendidos = PASSWORD_BASIC_REQUIREMENTS.every((item) => requisitos[item.id])
  const valida = basicosAtendidos && gruposAtendidos >= 3

  let nivel = 'empty'
  if (password) {
    if (valida) nivel = 'strong'
    else if (basicosAtendidos && gruposAtendidos >= 2) nivel = 'medium'
    else nivel = 'weak'
  }

  return { requisitos, gruposAtendidos, basicosAtendidos, errosCaracteres, nivel, valida }
}

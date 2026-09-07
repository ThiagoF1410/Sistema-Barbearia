export const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'Entre 8 e 72 caracteres' },
  { id: 'uppercase', label: 'Uma letra maiúscula' },
  { id: 'lowercase', label: 'Uma letra minúscula' },
  { id: 'number', label: 'Um número' },
  { id: 'special', label: 'Um caractere especial' },
]

function tamanhoUtf8(value) {
  return new TextEncoder().encode(value).length
}

export function analisarSenha(password = '') {
  const requisitos = {
    length: password.length >= 8 && password.length <= 72 && tamanhoUtf8(password) <= 72,
    uppercase: /\p{Lu}/u.test(password),
    lowercase: /\p{Ll}/u.test(password),
    number: /\p{N}/u.test(password),
    special: /[^\p{L}\p{N}\s]/u.test(password),
  }
  const atendidos = Object.values(requisitos).filter(Boolean).length

  let nivel = 'empty'
  if (password) nivel = Object.values(requisitos).every(Boolean)
    ? 'strong'
    : requisitos.length && atendidos >= 4
      ? 'medium'
      : 'weak'

  return { requisitos, nivel, valida: nivel === 'strong' }
}

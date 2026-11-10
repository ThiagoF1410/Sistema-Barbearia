const EMPTY_REGISTER_DRAFT = Object.freeze({
  nome: '',
  email: '',
  telefone: '',
  password: '',
  confirm_password: '',
  terms: false,
})

let registerDraft = { ...EMPTY_REGISTER_DRAFT }

export function obterRascunhoCadastro() {
  return { ...registerDraft }
}

export function atualizarRascunhoCadastro(nextDraft) {
  registerDraft = { ...EMPTY_REGISTER_DRAFT, ...nextDraft }
}

export function limparRascunhoCadastro() {
  registerDraft = { ...EMPTY_REGISTER_DRAFT }
}

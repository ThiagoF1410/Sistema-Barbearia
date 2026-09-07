import api from './api'

export async function listarProfissionais() {
  const res = await api.get('/profissionais')
  return res.data
}

export async function obterMeuPerfilProfissional() {
  const res = await api.get('/profissionais/me')
  return res.data
}

export async function listarProfissionaisAdmin() {
  const res = await api.get('/profissionais/gestao')
  return res.data
}

export async function criarProfissional(dados) {
  const res = await api.post('/profissionais', dados)
  return res.data
}

export async function atualizarProfissional(id, dados) {
  const res = await api.put(`/profissionais/${id}`, dados)
  return res.data
}

export async function alterarStatusProfissional(id, ativo) {
  const res = await api.patch(`/profissionais/${id}/status`, { ativo })
  return res.data
}

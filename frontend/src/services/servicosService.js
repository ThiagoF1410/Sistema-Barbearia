import api from './api'

export async function listarServicos() {
  const res = await api.get('/servicos')
  return res.data
}

export async function criarServico(data) {
  const res = await api.post('/servicos', data)
  return res.data
}

export async function atualizarServico(id, data) {
  const res = await api.put(`/servicos/${id}`, data)
  return res.data
}

export async function deletarServico(id) {
  const res = await api.delete(`/servicos/${id}`)
  return res.data
}

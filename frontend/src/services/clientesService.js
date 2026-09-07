import api from './api'

export async function listarClientesAdmin(filtros = {}) {
  const res = await api.get('/clientes/gestao', { params: filtros })
  return res.data
}

export async function atualizarClienteAdmin(id, dados) {
  const res = await api.put(`/clientes/${id}`, dados)
  return res.data
}

export async function listarAgendamentosClienteAdmin(id) {
  const res = await api.get(`/clientes/${id}/agendamentos`)
  return res.data
}

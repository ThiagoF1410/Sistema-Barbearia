import api from './api'

export async function criarAgendamento(dados) {
  const res = await api.post('/agendamentos', dados)
  return res.data
}

export async function listarMeusAgendamentos() {
  const res = await api.get('/agendamentos/meus')
  return res.data
}

export async function cancelarAgendamento(id) {
  const res = await api.patch(`/agendamentos/${id}/cancelar`)
  return res.data
}

export async function listarAgendamentosAdmin(filtros = {}) {
  const res = await api.get('/agendamentos/admin', { params: filtros })
  return res.data
}

export async function carregarDashboardAdmin(data) {
  const res = await api.get('/agendamentos/admin/dashboard', {
    params: data ? { data } : undefined,
  })
  return res.data
}

export async function concluirAgendamentoAdmin(id) {
  const res = await api.patch(`/agendamentos/${id}/concluir`)
  return res.data
}

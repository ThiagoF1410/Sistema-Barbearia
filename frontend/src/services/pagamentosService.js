import api from './api'

export async function criarCheckout(agendamentoId, produtos = []) {
  const res = await api.post('/pagamentos/checkout', {
    agendamentoId,
    produtos,
    origemRetorno: window.location.origin,
  })
  return res.data
}

export async function registrarPagamentoDinheiro(agendamentoId, produtos = []) {
  const res = await api.post('/pagamentos/dinheiro', { agendamentoId, produtos })
  return res.data
}

export async function consultarCheckout(sessionId) {
  const res = await api.get(`/pagamentos/checkout/${encodeURIComponent(sessionId)}`)
  return res.data
}

export async function listarPagamentosAdmin(filtros = {}) {
  const res = await api.get('/pagamentos/admin', { params: filtros })
  return res.data
}

export async function confirmarPagamentoDinheiro(pagamentoId) {
  const res = await api.patch(`/pagamentos/admin/${pagamentoId}/confirmar-dinheiro`)
  return res.data
}

export async function carregarRelatorioMensal(ano) {
  const res = await api.get('/pagamentos/admin/relatorio-mensal', { params: { ano } })
  return res.data
}

import api from './api'

export async function criarCheckout(agendamentoId) {
  const res = await api.post('/pagamentos/checkout', { agendamentoId })
  return res.data
}

export async function consultarCheckout(sessionId) {
  const res = await api.get(`/pagamentos/checkout/${encodeURIComponent(sessionId)}`)
  return res.data
}

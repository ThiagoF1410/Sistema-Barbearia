import api from './api'

export async function listarNotificacoes() {
  const resposta = await api.get('/notificacoes')
  return resposta.data
}

export async function marcarNotificacaoComoLida(id) {
  const resposta = await api.patch(`/notificacoes/${id}/lida`)
  return resposta.data
}

export async function marcarTodasNotificacoesComoLidas() {
  const resposta = await api.patch('/notificacoes/lidas')
  return resposta.data
}

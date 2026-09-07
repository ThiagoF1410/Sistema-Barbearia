import api from './api'

export async function criarCheckoutProdutos(itens) {
  const res = await api.post('/pedidos/checkout', { itens, origemRetorno: window.location.origin })
  return res.data
}

export async function criarPedidoDinheiro(itens) {
  const res = await api.post('/pedidos/dinheiro', { itens })
  return res.data
}

export async function reabrirCheckoutPedido(pedidoId) {
  const res = await api.post(`/pedidos/${pedidoId}/checkout`, { origemRetorno: window.location.origin })
  return res.data
}

export async function cancelarPedido(pedidoId) {
  const res = await api.patch(`/pedidos/${pedidoId}/cancelar`)
  return res.data
}

export async function listarMeusPedidos(filtros = {}) {
  const res = await api.get('/pedidos/meus', { params: filtros })
  return res.data
}

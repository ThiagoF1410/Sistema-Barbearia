function statusDoEvento(evento, sessao) {
  if (
    evento.type === 'checkout.session.async_payment_succeeded'
    || (evento.type === 'checkout.session.completed' && sessao.payment_status === 'paid')
  ) {
    return 'CONFIRMADO'
  }
  if (evento.type === 'checkout.session.async_payment_failed') return 'FALHOU'
  if (evento.type === 'checkout.session.expired') return 'CANCELADO'
  return null
}

module.exports = { statusDoEvento }

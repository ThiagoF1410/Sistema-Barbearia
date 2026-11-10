const test = require('node:test')
const assert = require('node:assert/strict')
const { statusDoEvento } = require('../src/utils/stripeWebhookUtils')

test('traduz eventos de pagamento confirmado', () => {
  assert.equal(
    statusDoEvento({ type: 'checkout.session.completed' }, { payment_status: 'paid' }),
    'CONFIRMADO'
  )
  assert.equal(
    statusDoEvento({ type: 'checkout.session.async_payment_succeeded' }, {}),
    'CONFIRMADO'
  )
})

test('traduz falha e expiracao de checkout', () => {
  assert.equal(statusDoEvento({ type: 'checkout.session.async_payment_failed' }, {}), 'FALHOU')
  assert.equal(statusDoEvento({ type: 'checkout.session.expired' }, {}), 'CANCELADO')
})

test('ignora evento sem mudanca de status', () => {
  assert.equal(
    statusDoEvento({ type: 'checkout.session.completed' }, { payment_status: 'unpaid' }),
    null
  )
  assert.equal(statusDoEvento({ type: 'customer.created' }, {}), null)
})

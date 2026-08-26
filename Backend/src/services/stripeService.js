const Stripe = require('stripe')

let stripe

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    const erro = new Error('STRIPE_SECRET_KEY não está configurada.')
    erro.code = 'STRIPE_NOT_CONFIGURED'
    throw erro
  }

  if (!stripe) stripe = new Stripe(secretKey)
  return stripe
}

function idPaymentIntentDaSessao(sessao) {
  if (!sessao?.payment_intent) return null
  return typeof sessao.payment_intent === 'string'
    ? sessao.payment_intent
    : sessao.payment_intent.id
}

function recursoStripeInexistente(err) {
  return err?.code === 'resource_missing' || err?.statusCode === 404
}

async function recuperarSessaoCheckout(stripe, sessionId) {
  if (!sessionId) return null

  try {
    return await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    if (recursoStripeInexistente(err)) return null
    throw err
  }
}

module.exports = {
  getStripe,
  idPaymentIntentDaSessao,
  recuperarSessaoCheckout,
}

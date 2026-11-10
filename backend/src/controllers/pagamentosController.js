const { webhookStripe } = require('./pagamentosWebhookController')
const { criarCheckout } = require('./pagamentosCheckoutController')
const {
  registrarPagamentoDinheiro,
  confirmarPagamentoDinheiro,
} = require('./pagamentosDinheiroController')
const { consultarCheckout } = require('./pagamentosConsultaController')

module.exports = {
  criarCheckout,
  registrarPagamentoDinheiro,
  confirmarPagamentoDinheiro,
  consultarCheckout,
  webhookStripe,
}

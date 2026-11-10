const contasController = require('./auth/contasController')
const recuperacaoSenhaController = require('./auth/recuperacaoSenhaController')
const sessoesController = require('./auth/sessoesController')

module.exports = {
  ...contasController,
  ...recuperacaoSenhaController,
  ...sessoesController,
}

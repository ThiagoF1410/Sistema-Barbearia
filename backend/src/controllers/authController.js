const contasController = require('./auth/contasController')
const recuperacaoSenhaController = require('./auth/recuperacaoSenhaController')

module.exports = {
  ...contasController,
  ...recuperacaoSenhaController,
}

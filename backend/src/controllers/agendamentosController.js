const { criar } = require('./agenda/agendamentosCriacaoController')
const { listarMeus, cancelar } = require('./agenda/agendamentosClienteController')
const {
  listarAdmin,
  dashboardAdmin,
  concluirAdmin,
} = require('./agenda/agendamentosAdminController')
const {
  dashboardProfissional,
} = require('./agenda/agendamentosProfissionalController')

module.exports = {
  criar,
  listarMeus,
  cancelar,
  listarAdmin,
  dashboardAdmin,
  dashboardProfissional,
  concluirAdmin,
}

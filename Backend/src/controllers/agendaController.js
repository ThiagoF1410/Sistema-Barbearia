const horariosController = require('./agenda/horariosController')
const feriadosController = require('./agenda/feriadosController')
const disponibilidadeController = require('./agenda/disponibilidadeController')
const datasAgendaController = require('./agenda/datasAgendaController')
const profissionaisAgendaController = require('./agenda/profissionaisAgendaController')

module.exports = {
  ...horariosController,
  ...feriadosController,
  ...disponibilidadeController,
  ...datasAgendaController,
  listarHorariosProfissional: profissionaisAgendaController.listarHorarios,
  salvarHorariosProfissional: profissionaisAgendaController.salvarHorarios,
  listarAusenciasProfissional: profissionaisAgendaController.listarAusencias,
  criarAusenciaProfissional: profissionaisAgendaController.criarAusencia,
  deletarAusenciaProfissional: profissionaisAgendaController.deletarAusencia,
}

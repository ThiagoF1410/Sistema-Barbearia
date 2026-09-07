const horariosController = require('./agenda/horariosController')
const feriadosController = require('./agenda/feriadosController')
const disponibilidadeController = require('./agenda/disponibilidadeController')
const datasAgendaController = require('./agenda/datasAgendaController')
const profissionaisAgendaController = require('./agenda/profissionaisAgendaController')
const solicitacoesAusenciaController = require('./agenda/solicitacoesAusenciaController')

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
  listarMeusHorariosProfissional: profissionaisAgendaController.listarMeusHorarios,
  listarMinhasAusenciasProfissional: profissionaisAgendaController.listarMinhasAusencias,
  listarMinhasSolicitacoesAusencia: solicitacoesAusenciaController.listarMinhasSolicitacoes,
  criarMinhaSolicitacaoAusencia: solicitacoesAusenciaController.criarMinhaSolicitacao,
  cancelarMinhaSolicitacaoAusencia: solicitacoesAusenciaController.cancelarMinhaSolicitacao,
  listarSolicitacoesAusenciaAdmin: solicitacoesAusenciaController.listarSolicitacoesAdmin,
  analisarSolicitacaoAusencia: solicitacoesAusenciaController.analisarSolicitacao,
}

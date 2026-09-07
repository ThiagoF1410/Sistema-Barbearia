const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/agendaController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')
const { cachePublico } = require('../middlewares/cacheMiddleware')

// Qualquer pessoa autenticada vê as datas disponíveis
router.get('/disponivel', authMiddleware, ctrl.listarDisponiveis)
router.get('/calendario', authMiddleware, ctrl.calendarioMensal)
router.get('/horarios-disponiveis', authMiddleware, ctrl.horariosDisponiveis)

router.get('/profissional/horarios', authMiddleware, roleGuard('profissional'), ctrl.listarMeusHorariosProfissional)
router.get('/profissional/ausencias', authMiddleware, roleGuard('profissional'), ctrl.listarMinhasAusenciasProfissional)
router.get('/profissional/solicitacoes-ausencia', authMiddleware, roleGuard('profissional'), ctrl.listarMinhasSolicitacoesAusencia)
router.post('/profissional/solicitacoes-ausencia', authMiddleware, roleGuard('profissional'), ctrl.criarMinhaSolicitacaoAusencia)
router.delete('/profissional/solicitacoes-ausencia/:solicitacaoId', authMiddleware, roleGuard('profissional'), ctrl.cancelarMinhaSolicitacaoAusencia)

// Admin vê tudo
router.get('/', authMiddleware, roleGuard('admin'), ctrl.listar)
router.get('/horarios', cachePublico(60), ctrl.listarHorarios)
router.put('/horarios', authMiddleware, roleGuard('admin'), ctrl.salvarHorarios)
router.get('/feriados', authMiddleware, roleGuard('admin'), ctrl.listarFeriados)
router.post('/feriados/importar/:ano', authMiddleware, roleGuard('admin'), ctrl.importarFeriados)
router.patch('/feriados/:id', authMiddleware, roleGuard('admin'), ctrl.atualizarFeriado)
router.get('/profissionais/:profissionalId/horarios', authMiddleware, roleGuard('admin'), ctrl.listarHorariosProfissional)
router.put('/profissionais/:profissionalId/horarios', authMiddleware, roleGuard('admin'), ctrl.salvarHorariosProfissional)
router.get('/profissionais/:profissionalId/ausencias', authMiddleware, roleGuard('admin'), ctrl.listarAusenciasProfissional)
router.post('/profissionais/:profissionalId/ausencias', authMiddleware, roleGuard('admin'), ctrl.criarAusenciaProfissional)
router.delete('/profissionais/:profissionalId/ausencias/:ausenciaId', authMiddleware, roleGuard('admin'), ctrl.deletarAusenciaProfissional)
router.get('/solicitacoes-ausencia', authMiddleware, roleGuard('admin'), ctrl.listarSolicitacoesAusenciaAdmin)
router.patch('/solicitacoes-ausencia/:solicitacaoId', authMiddleware, roleGuard('admin'), ctrl.analisarSolicitacaoAusencia)

// Somente admin gerencia a agenda
router.post('/',                      authMiddleware, roleGuard('admin'), ctrl.criar)
router.patch('/:id/disponibilidade',  authMiddleware, roleGuard('admin'), ctrl.alterarDisponibilidade)
router.delete('/:id',                 authMiddleware, roleGuard('admin'), ctrl.deletar)

module.exports = router

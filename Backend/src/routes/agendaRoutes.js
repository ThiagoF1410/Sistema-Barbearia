const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/agendaController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

// Qualquer pessoa autenticada vê as datas disponíveis
router.get('/disponivel', authMiddleware, ctrl.listarDisponiveis)
router.get('/calendario', authMiddleware, ctrl.calendarioMensal)
router.get('/horarios-disponiveis', authMiddleware, ctrl.horariosDisponiveis)

// Admin vê tudo
router.get('/', authMiddleware, roleGuard('admin'), ctrl.listar)
router.get('/horarios', ctrl.listarHorarios)
router.put('/horarios', authMiddleware, roleGuard('admin'), ctrl.salvarHorarios)
router.get('/feriados', authMiddleware, roleGuard('admin'), ctrl.listarFeriados)
router.post('/feriados/importar/:ano', authMiddleware, roleGuard('admin'), ctrl.importarFeriados)
router.patch('/feriados/:id', authMiddleware, roleGuard('admin'), ctrl.atualizarFeriado)
router.get('/profissionais/:profissionalId/horarios', authMiddleware, roleGuard('admin'), ctrl.listarHorariosProfissional)
router.put('/profissionais/:profissionalId/horarios', authMiddleware, roleGuard('admin'), ctrl.salvarHorariosProfissional)
router.get('/profissionais/:profissionalId/ausencias', authMiddleware, roleGuard('admin'), ctrl.listarAusenciasProfissional)
router.post('/profissionais/:profissionalId/ausencias', authMiddleware, roleGuard('admin'), ctrl.criarAusenciaProfissional)
router.delete('/profissionais/:profissionalId/ausencias/:ausenciaId', authMiddleware, roleGuard('admin'), ctrl.deletarAusenciaProfissional)

// Somente admin gerencia a agenda
router.post('/',                      authMiddleware, roleGuard('admin'), ctrl.criar)
router.patch('/:id/disponibilidade',  authMiddleware, roleGuard('admin'), ctrl.alterarDisponibilidade)
router.delete('/:id',                 authMiddleware, roleGuard('admin'), ctrl.deletar)

module.exports = router

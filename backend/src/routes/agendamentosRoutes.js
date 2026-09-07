const router = require('express').Router()
const ctrl = require('../controllers/agendamentosController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

router.post('/', authMiddleware, roleGuard('cliente'), ctrl.criar)
router.get('/meus', authMiddleware, roleGuard('cliente'), ctrl.listarMeus)
router.get('/profissional/dashboard', authMiddleware, roleGuard('profissional'), ctrl.dashboardProfissional)
router.get('/admin/dashboard', authMiddleware, roleGuard('admin'), ctrl.dashboardAdmin)
router.get('/admin', authMiddleware, roleGuard('admin'), ctrl.listarAdmin)
router.patch('/:id/concluir', authMiddleware, roleGuard('admin'), ctrl.concluirAdmin)
router.patch('/:id/cancelar', authMiddleware, roleGuard('cliente'), ctrl.cancelar)

module.exports = router

const router = require('express').Router()
const ctrl = require('../controllers/pagamentosController')
const adminCtrl = require('../controllers/adminFinanceiroController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

router.get('/admin', authMiddleware, roleGuard('admin'), adminCtrl.listarPagamentos)
router.get('/admin/relatorio-mensal', authMiddleware, roleGuard('admin'), adminCtrl.relatorioMensal)
router.patch('/admin/:pagamentoId/confirmar-dinheiro', authMiddleware, roleGuard('admin'), ctrl.confirmarPagamentoDinheiro)
router.post('/checkout', authMiddleware, roleGuard('cliente'), ctrl.criarCheckout)
router.post('/dinheiro', authMiddleware, roleGuard('cliente'), ctrl.registrarPagamentoDinheiro)
router.get('/checkout/:sessionId', authMiddleware, roleGuard('cliente'), ctrl.consultarCheckout)

module.exports = router

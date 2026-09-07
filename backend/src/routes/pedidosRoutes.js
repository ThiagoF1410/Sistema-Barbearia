const router = require('express').Router()
const ctrl = require('../controllers/pedidosController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

router.use(authMiddleware, roleGuard('cliente'))
router.get('/meus', ctrl.listarMeusPedidos)
router.post('/checkout', ctrl.criarCheckoutProdutos)
router.post('/dinheiro', ctrl.criarPedidoDinheiro)
router.post('/:id/checkout', ctrl.reabrirCheckout)
router.patch('/:id/cancelar', ctrl.cancelarPedido)

module.exports = router

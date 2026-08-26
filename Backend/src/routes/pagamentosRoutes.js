const router = require('express').Router()
const ctrl = require('../controllers/pagamentosController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

router.post('/checkout', authMiddleware, roleGuard('cliente'), ctrl.criarCheckout)
router.get('/checkout/:sessionId', authMiddleware, roleGuard('cliente'), ctrl.consultarCheckout)

module.exports = router

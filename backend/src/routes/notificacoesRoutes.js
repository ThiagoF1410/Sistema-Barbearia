const router = require('express').Router()
const controller = require('../controllers/notificacoesController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

router.use(authMiddleware, roleGuard('admin', 'profissional'))
router.get('/', controller.listar)
router.patch('/lidas', controller.marcarTodasComoLidas)
router.patch('/:id/lida', controller.marcarComoLida)

module.exports = router

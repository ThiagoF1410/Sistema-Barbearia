const express        = require('express')
const router         = express.Router()
const authController = require('../controllers/authController')
const clientesController = require('../controllers/clientesController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')
const { limitarAutenticacao } = require('../middlewares/rateLimitMiddleware')

router.post('/', limitarAutenticacao, authController.register)
router.get('/gestao', authMiddleware, roleGuard('admin'), clientesController.listarGestao)
router.get('/:id/agendamentos', authMiddleware, roleGuard('admin'), clientesController.listarAgendamentos)
router.put('/:id', authMiddleware, roleGuard('admin'), clientesController.atualizar)

module.exports = router

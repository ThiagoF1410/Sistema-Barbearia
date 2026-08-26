const router = require('express').Router()
const ctrl = require('../controllers/whatsappController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')
const { limitarWhatsAppTeste } = require('../middlewares/rateLimitMiddleware')

router.get('/status', authMiddleware, roleGuard('admin'), ctrl.consultarStatus)

router.post(
  '/teste',
  authMiddleware,
  roleGuard('admin'),
  limitarWhatsAppTeste,
  ctrl.enviarTeste
)

module.exports = router

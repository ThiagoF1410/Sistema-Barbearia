const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')
const { limitarAutenticacao, limitarRecuperacao } = require('../middlewares/rateLimitMiddleware')

router.post('/register', limitarAutenticacao, authController.register)
router.post('/login', limitarAutenticacao, authController.login)
router.get('/me', authMiddleware, authController.getMe)
router.patch('/me', authMiddleware, authController.updateMe)
router.post('/forgot-password', limitarRecuperacao, authController.forgotPassword)
router.post('/reset-password', limitarRecuperacao, authController.resetPassword)
router.get('/admin/usuarios', authMiddleware, roleGuard('admin'), authController.listarUsuarios)

module.exports = router

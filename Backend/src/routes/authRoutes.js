<<<<<<< HEAD:Backend/src/routes/authRoutes.js
const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const authMiddleware = require('../middlewares/authMiddleware')

router.post('/register', authController.register)
router.post('/login', authController.login)
router.get('/me', authMiddleware, authController.getMe)

module.exports = router
=======
const express      = require('express')
const router       = express.Router()
const authController = require('../controllers/authController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')
const { limitarAutenticacao, limitarRecuperacao } = require('../middlewares/rateLimitMiddleware')

router.post('/register',        limitarAutenticacao, authController.register)
router.post('/login',           limitarAutenticacao, authController.login)
router.get('/me',               authMiddleware, authController.getMe)
router.post('/forgot-password', limitarRecuperacao, authController.forgotPassword)
router.post('/reset-password',  limitarRecuperacao, authController.resetPassword)

router.get('/admin/usuarios', authMiddleware, roleGuard('admin'), authController.listarUsuarios)

module.exports = router
>>>>>>> fd3eb50 (Commit Projeto):backend/src/routes/authRoutes.js

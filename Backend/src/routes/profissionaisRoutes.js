const router = require('express').Router()
const ctrl = require('../controllers/profissionaisController')
const { authMiddleware } = require('../middlewares/authMiddleware')

router.get('/', authMiddleware, ctrl.listar)

module.exports = router

const express    = require('express')
const router     = express.Router()
const ctrl       = require('../controllers/servicosController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

// Catálogo público
router.get('/', ctrl.listar)
router.get('/:id', ctrl.buscarPorId)

// Somente admin pode criar, editar e deletar
router.post('/',    authMiddleware, roleGuard('admin'), ctrl.criar)
router.put('/:id',  authMiddleware, roleGuard('admin'), ctrl.atualizar)
router.delete('/:id', authMiddleware, roleGuard('admin'), ctrl.deletar)

module.exports = router

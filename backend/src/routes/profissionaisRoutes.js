const router = require('express').Router()
const ctrl = require('../controllers/profissionaisController')
const { authMiddleware, roleGuard } = require('../middlewares/authMiddleware')

router.get('/', authMiddleware, ctrl.listar)
router.get('/me', authMiddleware, roleGuard('profissional'), ctrl.obterMeuPerfil)
router.get('/gestao', authMiddleware, roleGuard('admin'), ctrl.listarGestao)
router.post('/', authMiddleware, roleGuard('admin'), ctrl.criar)
router.put('/:id', authMiddleware, roleGuard('admin'), ctrl.atualizar)
router.patch('/:id/status', authMiddleware, roleGuard('admin'), ctrl.alterarStatus)

module.exports = router

const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')

async function listar(req, res) {
  try {
    const [itensResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT idnotificacao, tipo, titulo, mensagem, link,
                referencia_tipo, referencia_id, lida_em, criada_em
         FROM public.notificacao
         WHERE usuario_idusuario = $1
         ORDER BY criada_em DESC, idnotificacao DESC
         LIMIT 30`,
        [req.userId]
      ),
      pool.query(
        `SELECT COUNT(*)::integer AS total
         FROM public.notificacao
         WHERE usuario_idusuario = $1 AND lida_em IS NULL`,
        [req.userId]
      ),
    ])
    return res.status(200).json({
      notificacoes: itensResult.rows,
      naoLidas: totalResult.rows[0]?.total || 0,
    })
  } catch (err) {
    console.error('Erro ao listar notificações:', err)
    return res.status(500).json({ message: 'Não foi possível carregar as notificações agora.' })
  }
}

async function marcarComoLida(req, res) {
  const notificacaoId = Number(req.params.id)
  if (!idValido(notificacaoId)) {
    return res.status(400).json({ message: 'Notificação inválida.' })
  }
  try {
    const result = await pool.query(
      `UPDATE public.notificacao
       SET lida_em = COALESCE(lida_em, NOW())
       WHERE idnotificacao = $1 AND usuario_idusuario = $2
       RETURNING idnotificacao, lida_em`,
      [notificacaoId, req.userId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Notificação não encontrada.' })
    }
    return res.status(200).json(result.rows[0])
  } catch (err) {
    console.error('Erro ao atualizar notificação:', err)
    return res.status(500).json({ message: 'Não foi possível atualizar a notificação.' })
  }
}

async function marcarTodasComoLidas(req, res) {
  try {
    const result = await pool.query(
      `UPDATE public.notificacao
       SET lida_em = NOW()
       WHERE usuario_idusuario = $1 AND lida_em IS NULL
       RETURNING idnotificacao`,
      [req.userId]
    )
    return res.status(200).json({ atualizadas: result.rowCount })
  } catch (err) {
    console.error('Erro ao atualizar notificações:', err)
    return res.status(500).json({ message: 'Não foi possível atualizar as notificações.' })
  }
}

module.exports = { listar, marcarComoLida, marcarTodasComoLidas }

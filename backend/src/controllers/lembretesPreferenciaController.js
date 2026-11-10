const pool = require('../config/db')
async function preferencia(req, res) {
  if (req.method === 'PATCH' && typeof req.body?.habilitado !== 'boolean') return res.status(400).json({message:'Informe uma preferência válida.'})
  try {
    const escrita = req.method === 'PATCH'
    const resultado = await pool.query(escrita
      ? 'UPDATE public.cliente SET receber_lembretes_whatsapp = $2 WHERE usuario_idusuario = $1 RETURNING receber_lembretes_whatsapp'
      : 'SELECT receber_lembretes_whatsapp FROM public.cliente WHERE usuario_idusuario = $1',
    escrita ? [req.userId, req.body.habilitado] : [req.userId])
    if (!resultado.rows.length) return res.status(404).json({message:'Cliente não encontrado.'})
    return res.json({habilitado:resultado.rows[0].receber_lembretes_whatsapp})
  } catch {
    return res.status(503).json({message:'Preferências temporariamente indisponíveis.'})
  }
}
module.exports = { preferencia }

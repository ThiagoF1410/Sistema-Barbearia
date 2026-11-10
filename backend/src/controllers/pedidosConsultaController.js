const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { normalizarPaginacao, montarPaginacao } = require('../utils/paginationUtils')

async function listarMeusPedidos(req, res) {
  const paginacao = normalizarPaginacao(req.query)
  if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })
  const status = String(req.query.status || '').trim().toUpperCase()
  const statusPermitidos = ['PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU', 'AGUARDANDO']
  if (status && !statusPermitidos.includes(status)) {
    return res.status(400).json({ message: 'Situacao do pedido invalida.' })
  }
  try {
    const valores = [req.userId]
    const filtroStatus = status === 'AGUARDANDO'
      ? "AND pe.status IN ('PENDENTE', 'FALHOU')"
      : status ? 'AND pe.status = $2' : ''
    if (status && status !== 'AGUARDANDO') valores.push(status)
    const limiteSql = paginacao.solicitada
      ? `LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`
      : ''
    const valoresConsulta = paginacao.solicitada
      ? [...valores, paginacao.limite, paginacao.offset]
      : valores
    const result = await pool.query(
      `SELECT pe.idpedido, pe.tipo, pe.status, pe.total,
              TO_CHAR(pe.criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS criado_em,
              (SELECT p.metodo FROM public.pagamento p
               WHERE p.pedido_idpedido = pe.idpedido
               ORDER BY p.idpagamento DESC LIMIT 1) AS metodo,
              (SELECT p.checkout_expira_em FROM public.pagamento p
               WHERE p.pedido_idpedido = pe.idpedido
               ORDER BY p.idpagamento DESC LIMIT 1) AS checkout_expira_em,
              COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
                'nome', pi.nome_snapshot, 'quantidade', pi.quantidade,
                'preco', pi.preco_snapshot, 'subtotal', pi.subtotal
              ) ORDER BY pi.idpedidoitem) FILTER (WHERE pi.idpedidoitem IS NOT NULL), '[]') AS itens
       FROM public.pedido pe
       JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
       LEFT JOIN public.pedido_item pi ON pi.pedido_idpedido = pe.idpedido
       WHERE c.usuario_idusuario = $1
         AND pe.tipo = 'AVULSO'
         ${filtroStatus}
       GROUP BY pe.idpedido
       ORDER BY pe.criado_em DESC
       ${limiteSql}`,
      valoresConsulta
    )
    if (paginacao.solicitada) {
      const [contagem, resumo] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::integer AS total FROM public.pedido pe
           JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
           WHERE c.usuario_idusuario = $1 AND pe.tipo = 'AVULSO' ${filtroStatus}`,
          valores
        ),
        pool.query(
          `SELECT pe.status, COUNT(*)::integer AS total FROM public.pedido pe
           JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
           WHERE c.usuario_idusuario = $1 AND pe.tipo = 'AVULSO'
           GROUP BY pe.status`,
          [req.userId]
        ),
      ])
      const porStatus = Object.fromEntries(resumo.rows.map((item) => [item.status, Number(item.total)]))
      const totalGeral = Object.values(porStatus).reduce((soma, quantidade) => soma + quantidade, 0)
      return res.status(200).json({
        pedidos: result.rows,
        resumo: { total: totalGeral, porStatus },
        paginacao: montarPaginacao(contagem.rows[0]?.total, paginacao.pagina, paginacao.limite),
      })
    }
    return res.status(200).json(result.rows)
  } catch (err) {
    registrarErro('Erro ao listar pedidos:', err)
    return res.status(500).json({ message: 'Não foi possível carregar seus pedidos.' })
  }
}

module.exports = { listarMeusPedidos }

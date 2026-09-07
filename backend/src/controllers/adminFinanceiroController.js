const pool = require('../config/db')
const { dataIsoValida } = require('../utils/agendaUtils')
const { normalizarPaginacao, montarPaginacao } = require('../utils/paginationUtils')

const STATUS_PAGAMENTO = new Set(['PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU'])

function anoValido(valor) {
  return /^\d{4}$/.test(String(valor)) && Number(valor) >= 2000 && Number(valor) <= 2100
}

function filtrosPagamentos(query = {}) {
  const status = String(query.status || '').trim().toUpperCase()
  const inicio = String(query.inicio || '').trim()
  const fim = String(query.fim || '').trim()
  const busca = String(query.busca || '').trim().slice(0, 100)

  if (status && !STATUS_PAGAMENTO.has(status)) {
    return { erro: 'Status de pagamento inválido.' }
  }
  if (inicio && !dataIsoValida(inicio)) return { erro: 'Data inicial inválida.' }
  if (fim && !dataIsoValida(fim)) return { erro: 'Data final inválida.' }
  if (inicio && fim && inicio > fim) {
    return { erro: 'A data inicial não pode ser posterior à data final.' }
  }

  return { status, inicio, fim, ...(busca ? { busca } : {}) }
}

function criarAdminFinanceiroController(db = pool) {
  async function listarPagamentos(req, res) {
    const filtros = filtrosPagamentos(req.query)
    if (filtros.erro) return res.status(400).json({ message: filtros.erro })
    const paginacao = normalizarPaginacao(req.query)
    if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })

    const where = []
    const valores = []
    if (filtros.status) {
      valores.push(filtros.status)
      where.push(`p.statuspagamento = $${valores.length}`)
    }
    if (filtros.inicio) {
      valores.push(filtros.inicio)
      where.push(`COALESCE(a.dataagendamento, p.datapagamento) >= $${valores.length}::date`)
    }
    if (filtros.fim) {
      valores.push(filtros.fim)
      where.push(`COALESCE(a.dataagendamento, p.datapagamento) <= $${valores.length}::date`)
    }
    if (filtros.busca) {
      valores.push(`%${filtros.busca}%`)
      where.push(`(uc.nome ILIKE $${valores.length} OR uc.email ILIKE $${valores.length}
        OR COALESCE(a.servico_nome_snapshot, 'Compra de produtos') ILIKE $${valores.length})`)
    }

    try {
      const consultaBase =
        `SELECT p.idpagamento,
                p.agendamento_idagendamento AS idagendamento,
                p.pedido_idpedido AS idpedido,
                TO_CHAR(p.datapagamento, 'YYYY-MM-DD') AS datapagamento,
                p.valor,
                p.statuspagamento,
                p.metodo,
                p.moeda,
                TO_CHAR(p.atualizado_em AT TIME ZONE 'America/Sao_Paulo',
                        'YYYY-MM-DD HH24:MI') AS atualizado_em,
                TO_CHAR(COALESCE(a.dataagendamento, p.datapagamento), 'YYYY-MM-DD') AS data,
                TO_CHAR(a.horario, 'HH24:MI') AS horario,
                a.statusagendamento,
                COALESCE(a.servico_nome_snapshot, 'Compra de produtos') AS servico,
                uc.nome AS cliente,
                uc.email AS cliente_email,
                up.nome AS profissional
         FROM public.pagamento p
         LEFT JOIN public.agendamento a
           ON a.idagendamento = p.agendamento_idagendamento
         LEFT JOIN public.pedido pe ON pe.idpedido = p.pedido_idpedido
         JOIN public.cliente c ON c.idcliente = COALESCE(a.cliente_idcliente, pe.cliente_idcliente)
         JOIN public.usuario uc ON uc.idusuario = c.usuario_idusuario
         LEFT JOIN public.profissional pr ON pr.idprofissional = a.profissional_idprofissional
         LEFT JOIN public.usuario up ON up.idusuario = pr.usuario_idusuario
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
      const valoresLista = [...valores]
      let limiteSql = ''
      if (paginacao.solicitada) {
        valoresLista.push(paginacao.limite, paginacao.offset)
        limiteSql = ` LIMIT $${valoresLista.length - 1} OFFSET $${valoresLista.length}`
      }
      const result = await db.query(
        `${consultaBase}
         ORDER BY COALESCE(a.dataagendamento, p.datapagamento) DESC, a.horario DESC NULLS LAST, p.idpagamento DESC${limiteSql}`,
        valoresLista
      )

      let linhasResumo = result.rows
      if (paginacao.solicitada) {
        const resumoResult = await db.query(
          `SELECT COUNT(*)::integer AS quantidade,
                  COUNT(*) FILTER (WHERE p.statuspagamento = 'CONFIRMADO')::integer AS confirmados,
                  COUNT(*) FILTER (WHERE p.statuspagamento = 'PENDENTE')::integer AS pendentes,
                  COUNT(*) FILTER (WHERE p.statuspagamento = 'FALHOU')::integer AS falhos,
                  COUNT(*) FILTER (WHERE p.statuspagamento = 'CANCELADO')::integer AS cancelados,
                  COALESCE(SUM(p.valor) FILTER (WHERE p.statuspagamento = 'CONFIRMADO'), 0)::numeric AS valor_confirmado
           FROM public.pagamento p
           LEFT JOIN public.agendamento a ON a.idagendamento = p.agendamento_idagendamento
           LEFT JOIN public.pedido pe ON pe.idpedido = p.pedido_idpedido
           JOIN public.cliente c ON c.idcliente = COALESCE(a.cliente_idcliente, pe.cliente_idcliente)
           JOIN public.usuario uc ON uc.idusuario = c.usuario_idusuario
           ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
          valores
        )
        const linha = resumoResult.rows[0] || {}
        const resumo = {
          quantidade: Number(linha.quantidade || 0), confirmados: Number(linha.confirmados || 0),
          pendentes: Number(linha.pendentes || 0), falhos: Number(linha.falhos || 0),
          cancelados: Number(linha.cancelados || 0), valorConfirmado: Number(linha.valor_confirmado || 0),
        }
        return res.status(200).json({
          resumo,
          pagamentos: result.rows,
          paginacao: montarPaginacao(resumo.quantidade, paginacao.pagina, paginacao.limite),
        })
      }

      const resumo = linhasResumo.reduce((total, pagamento) => {
        total.quantidade += 1
        if (pagamento.statuspagamento === 'CONFIRMADO') {
          total.confirmados += 1
          total.valorConfirmado += Number(pagamento.valor)
        } else if (pagamento.statuspagamento === 'PENDENTE') total.pendentes += 1
        else if (pagamento.statuspagamento === 'FALHOU') total.falhos += 1
        else if (pagamento.statuspagamento === 'CANCELADO') total.cancelados += 1
        return total
      }, { quantidade: 0, confirmados: 0, pendentes: 0, falhos: 0, cancelados: 0, valorConfirmado: 0 })

      return res.status(200).json({ resumo, pagamentos: result.rows })
    } catch (err) {
      console.error('Erro ao listar pagamentos para o administrador:', err)
      return res.status(500).json({ message: 'Erro interno no servidor.' })
    }
  }

  async function relatorioMensal(req, res) {
    const ano = String(req.query.ano || new Date().getFullYear())
    if (!anoValido(ano)) return res.status(400).json({ message: 'Ano inválido.' })

    try {
      const result = await db.query(
        `WITH meses AS (
           SELECT GENERATE_SERIES(1, 12)::integer AS mes
         ), agendamentos_mes AS (
           SELECT EXTRACT(MONTH FROM dataagendamento)::integer AS mes,
                  COUNT(*)::integer AS total_agendamentos,
                  COUNT(*) FILTER (WHERE statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                  COUNT(*) FILTER (WHERE statusagendamento = 'CANCELADO')::integer AS cancelados
           FROM public.agendamento
           WHERE dataagendamento >= $1::date
             AND dataagendamento < $2::date
           GROUP BY 1
         ), pagamentos_mes AS (
           SELECT EXTRACT(MONTH FROM p.datapagamento)::integer AS mes,
                  COUNT(*) FILTER (WHERE p.statuspagamento = 'CONFIRMADO')::integer AS pagamentos_confirmados,
                  COALESCE(SUM(p.valor) FILTER (WHERE p.statuspagamento = 'CONFIRMADO'), 0)::numeric(12, 2) AS faturamento
           FROM public.pagamento p
           WHERE p.datapagamento >= $1::date
             AND p.datapagamento < $2::date
           GROUP BY 1
         )
         SELECT m.mes,
                COALESCE(a.total_agendamentos, 0)::integer AS total_agendamentos,
                COALESCE(a.concluidos, 0)::integer AS concluidos,
                COALESCE(a.cancelados, 0)::integer AS cancelados,
                COALESCE(p.pagamentos_confirmados, 0)::integer AS pagamentos_confirmados,
                COALESCE(p.faturamento, 0)::numeric(12, 2) AS faturamento
         FROM meses m
         LEFT JOIN agendamentos_mes a ON a.mes = m.mes
         LEFT JOIN pagamentos_mes p ON p.mes = m.mes
         ORDER BY m.mes`,
        [`${ano}-01-01`, `${Number(ano) + 1}-01-01`]
      )

      const totais = result.rows.reduce((total, item) => ({
        total_agendamentos: total.total_agendamentos + Number(item.total_agendamentos),
        concluidos: total.concluidos + Number(item.concluidos),
        cancelados: total.cancelados + Number(item.cancelados),
        pagamentos_confirmados: total.pagamentos_confirmados + Number(item.pagamentos_confirmados),
        faturamento: total.faturamento + Number(item.faturamento),
      }), { total_agendamentos: 0, concluidos: 0, cancelados: 0, pagamentos_confirmados: 0, faturamento: 0 })

      return res.status(200).json({ ano: Number(ano), totais, meses: result.rows })
    } catch (err) {
      console.error('Erro ao gerar relatório mensal:', err)
      return res.status(500).json({ message: 'Erro interno no servidor.' })
    }
  }

  return { listarPagamentos, relatorioMensal }
}

const controller = criarAdminFinanceiroController()

module.exports = {
  ...controller,
  anoValido,
  filtrosPagamentos,
  criarAdminFinanceiroController,
}

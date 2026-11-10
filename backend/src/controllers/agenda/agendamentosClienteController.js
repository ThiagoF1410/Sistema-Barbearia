const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { idValido } = require('../../utils/agendaUtils')
const { normalizarPaginacao, montarPaginacao } = require('../../utils/paginationUtils')
const {
  getStripe,
  idPaymentIntentDaSessao,
  recuperarSessaoCheckout,
} = require('../../services/stripeService')

async function listarMeus(req, res) {
  const paginacao = normalizarPaginacao(req.query)
  if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })
  const status = String(req.query.status || '').trim().toUpperCase()
  if (status && !['AGENDADO', 'CONCLUIDO', 'CANCELADO'].includes(status)) {
    return res.status(400).json({ message: 'Situacao do agendamento invalida.' })
  }
  try {
    if (paginacao.solicitada) {
      const valores = [req.userId]
      const filtroStatus = status ? `AND a.statusagendamento = $2` : ''
      if (status) valores.push(status)
      valores.push(paginacao.limite, paginacao.offset)
      const limitePosicao = valores.length - 1
      const [result, contagem, resumo] = await Promise.all([
        pool.query(
          `SELECT a.idagendamento,
                  TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                  TO_CHAR(a.horario, 'HH24:MI') AS horario,
                  a.statusagendamento, a.servico, a.duracao, a.preco, a.profissional,
                  p.statuspagamento, p.metodo, p.checkout_expira_em,
                  ((a.dataagendamento + a.horario) > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                    AND a.statusagendamento = 'AGENDADO'
                    AND COALESCE(p.metodo, 'STRIPE') <> 'DINHEIRO'
                    AND (p.checkout_expira_em IS NULL OR p.checkout_expira_em > NOW())
                    AND COALESCE(p.statuspagamento, '') NOT IN ('CONFIRMADO', 'PAGO') AS pode_pagar,
                  ((a.dataagendamento + a.horario) > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 hours')
                    AND a.statusagendamento = 'AGENDADO' AS pode_cancelar
           FROM public.vw_agendamentos_completos a
           LEFT JOIN public.pagamento p ON p.agendamento_idagendamento = a.idagendamento
           WHERE a.cliente_usuario_id = $1 ${filtroStatus}
           ORDER BY a.dataagendamento DESC, a.horario DESC
           LIMIT $${limitePosicao} OFFSET $${limitePosicao + 1}`,
          valores
        ),
        pool.query(
          `SELECT COUNT(*)::integer AS total FROM public.vw_agendamentos_completos a
           WHERE a.cliente_usuario_id = $1 ${filtroStatus}`,
          valores.slice(0, limitePosicao - 1)
        ),
        pool.query(
          `SELECT COUNT(*)::integer AS total,
                  COUNT(*) FILTER (WHERE statusagendamento = 'AGENDADO')::integer AS agendados,
                  COUNT(*) FILTER (WHERE statusagendamento = 'CONCLUIDO')::integer AS concluidos,
                  COUNT(*) FILTER (WHERE statusagendamento = 'CANCELADO')::integer AS cancelados
           FROM public.vw_agendamentos_completos WHERE cliente_usuario_id = $1`,
          [req.userId]
        ),
      ])
      return res.status(200).json({
        agendamentos: result.rows,
        resumo: resumo.rows[0],
        paginacao: montarPaginacao(contagem.rows[0]?.total, paginacao.pagina, paginacao.limite),
      })
    }
    const result = await pool.query(
      `SELECT a.idagendamento,
              TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
              TO_CHAR(a.horario, 'HH24:MI') AS horario,
              a.statusagendamento,
              a.servico, a.duracao, a.preco,
              a.profissional,
              p.statuspagamento, p.metodo, p.checkout_expira_em,
              ((a.dataagendamento + a.horario)
                > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                AND a.statusagendamento = 'AGENDADO'
                AND COALESCE(p.metodo, 'STRIPE') <> 'DINHEIRO'
                AND (p.checkout_expira_em IS NULL OR p.checkout_expira_em > NOW())
                AND COALESCE(p.statuspagamento, '') NOT IN ('CONFIRMADO', 'PAGO') AS pode_pagar,
              ((a.dataagendamento + a.horario)
                > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 hours')
                AND a.statusagendamento = 'AGENDADO' AS pode_cancelar
       FROM public.vw_agendamentos_completos a
       LEFT JOIN public.pagamento p
         ON p.agendamento_idagendamento = a.idagendamento
       WHERE a.cliente_usuario_id = $1
       ORDER BY a.dataagendamento DESC, a.horario DESC`,
      [req.userId]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    registrarErro('Erro ao listar agendamentos do cliente:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function cancelar(req, res) {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Agendamento inválido.' })

  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true

    const existente = await client.query(
      `SELECT a.idagendamento, a.statusagendamento,
              (a.dataagendamento + a.horario)
                > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '2 hours' AS dentro_prazo
       FROM public.agendamento a
       JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
       WHERE a.idagendamento = $1 AND c.usuario_idusuario = $2
       FOR UPDATE OF a`,
      [req.params.id, req.userId]
    )

    if (!existente.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Agendamento não encontrado.' })
    }

    if (existente.rows[0].statusagendamento !== 'AGENDADO') {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Este agendamento não está ativo.' })
    }
    if (!existente.rows[0].dentro_prazo) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'O cancelamento deve ser feito com mais de 2 horas de antecedência.' })
    }

    const pagamentoResult = await client.query(
      `SELECT idpagamento, statuspagamento, stripe_checkout_session_id
       FROM public.pagamento
       WHERE agendamento_idagendamento = $1
       FOR UPDATE`,
      [req.params.id]
    )
    const pagamento = pagamentoResult.rows[0]

    if (['CONFIRMADO', 'PAGO'].includes(pagamento?.statuspagamento)) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({
        message: 'Este agendamento já foi pago. Entre em contato com a barbearia para solicitar cancelamento e estorno.',
      })
    }

    if (pagamento?.stripe_checkout_session_id) {
      const stripe = getStripe()
      const sessao = await recuperarSessaoCheckout(stripe, pagamento.stripe_checkout_session_id)

      if (sessao?.payment_status === 'paid') {
        await client.query(
          `UPDATE public.pagamento
           SET statuspagamento = 'CONFIRMADO',
               stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
               atualizado_em = NOW()
           WHERE idpagamento = $1`,
          [pagamento.idpagamento, idPaymentIntentDaSessao(sessao)]
        )
        await client.query('COMMIT')
        transacaoAtiva = false
        return res.status(409).json({
          message: 'O pagamento já foi confirmado. Entre em contato com a barbearia para solicitar cancelamento e estorno.',
        })
      }

      if (
        sessao?.status === 'complete'
        && pagamento.statuspagamento !== 'FALHOU'
      ) {
        await client.query('ROLLBACK')
        transacaoAtiva = false
        return res.status(409).json({
          message: 'O pagamento está em processamento. Aguarde a confirmação antes de cancelar.',
        })
      }

      if (sessao?.status === 'open') {
        await stripe.checkout.sessions.expire(sessao.id)
      }
    }

    const result = await client.query(
      `UPDATE public.agendamento
       SET statusagendamento = 'CANCELADO'
       WHERE idagendamento = $1
       RETURNING idagendamento, statusagendamento`,
      [req.params.id]
    )

    if (pagamento) {
      await client.query(
        `UPDATE public.pagamento
         SET statuspagamento = 'CANCELADO', atualizado_em = NOW()
         WHERE idpagamento = $1
           AND statuspagamento IN ('PENDENTE', 'FALHOU', 'CANCELADO')`,
        [pagamento.idpagamento]
      )
    }

    await client.query('COMMIT')
    transacaoAtiva = false
    return res.status(200).json({ message: 'Agendamento cancelado.', ...result.rows[0] })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Não foi possível cancelar o pagamento agora.' })
    }
    registrarErro('Erro ao cancelar agendamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { listarMeus, cancelar }

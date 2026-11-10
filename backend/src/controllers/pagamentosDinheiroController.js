const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const { carregarProdutos, substituirItens, totalProdutos } = require('../services/pedidosService')
const { solicitarNotificacaoWhatsapp } = require('../services/disparoNotificacaoWhatsappService')

async function registrarPagamentoDinheiro(req, res) {
  const { agendamentoId, produtos: itensProdutos = [] } = req.body || {}
  if (!idValido(agendamentoId)) {
    return res.status(400).json({ message: 'Informe um agendamento válido.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('pagamento_dinheiro'), $1::integer)",
      [agendamentoId]
    )

    const agendamentoResult = await client.query(
      `SELECT a.idagendamento, a.valor_snapshot AS preco, a.statusagendamento,
              c.idcliente,
              (a.dataagendamento + a.horario)
                > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS futuro
       FROM public.agendamento a
       JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
       WHERE a.idagendamento = $1 AND c.usuario_idusuario = $2
       FOR UPDATE OF a`,
      [agendamentoId, req.userId]
    )
    if (!agendamentoResult.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Agendamento não encontrado.' })
    }

    const agendamento = agendamentoResult.rows[0]
    if (agendamento.statusagendamento !== 'AGENDADO' || !agendamento.futuro) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Somente agendamentos futuros e ativos podem receber pagamento em dinheiro.' })
    }

    const pagamentoAtual = await client.query(
      `SELECT idpagamento, statuspagamento, metodo, stripe_checkout_session_id, pedido_idpedido
       FROM public.pagamento
       WHERE agendamento_idagendamento = $1
       FOR UPDATE`,
      [agendamentoId]
    )
    const existente = pagamentoAtual.rows[0]
    if (existente?.statuspagamento === 'CONFIRMADO') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este agendamento já está pago.' })
    }
    if (existente?.stripe_checkout_session_id) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Já existe um pagamento on-line iniciado para este agendamento.' })
    }

    const produtos = await carregarProdutos(client, itensProdutos)
    const totalAdicionais = totalProdutos(produtos)
    const valorTotal = Number((Number(agendamento.preco) + totalAdicionais).toFixed(2))
    let pedidoId = existente?.pedido_idpedido || null

    if (produtos.length) {
      const pedidoResult = await client.query(
        `INSERT INTO public.pedido
          (cliente_idcliente, agendamento_idagendamento, tipo, status, total)
         VALUES ($1, $2, 'AGENDAMENTO', 'PENDENTE', $3)
         ON CONFLICT (agendamento_idagendamento) WHERE agendamento_idagendamento IS NOT NULL
         DO UPDATE SET total = EXCLUDED.total, status = 'PENDENTE', atualizado_em = NOW()
         RETURNING idpedido`,
        [agendamento.idcliente, agendamentoId, totalAdicionais]
      )
      pedidoId = pedidoResult.rows[0].idpedido
      await substituirItens(client, pedidoId, produtos)
    }

    const pagamento = await client.query(
      `INSERT INTO public.pagamento
        (agendamento_idagendamento, pedido_idpedido, datapagamento, valor,
         statuspagamento, metodo, moeda, stripe_checkout_session_id, stripe_payment_intent_id, atualizado_em)
       VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
               $3, 'PENDENTE', 'DINHEIRO', 'brl', NULL, NULL, NOW())
       ON CONFLICT (agendamento_idagendamento) DO UPDATE SET
         pedido_idpedido = EXCLUDED.pedido_idpedido,
         valor = EXCLUDED.valor,
         statuspagamento = 'PENDENTE',
         metodo = 'DINHEIRO',
         stripe_checkout_session_id = NULL,
         stripe_payment_intent_id = NULL,
         checkout_expira_em = NULL,
         expirado_em = NULL,
         atualizado_em = NOW()
       WHERE pagamento.statuspagamento IN ('PENDENTE', 'FALHOU', 'CANCELADO')
         AND pagamento.stripe_checkout_session_id IS NULL
       RETURNING idpagamento, statuspagamento, metodo, valor`,
      [agendamentoId, pedidoId, valorTotal]
    )
    if (!pagamento.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Não foi possível alterar a forma de pagamento deste agendamento.' })
    }

    await client.query(
      `INSERT INTO public.whatsapp_notificacao
        (agendamento_idagendamento, tipo, proxima_tentativa_em)
       VALUES ($1, 'RESERVA_DINHEIRO', NOW())
       ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
      [agendamentoId]
    )

    await client.query('COMMIT')
    solicitarNotificacaoWhatsapp(agendamentoId)
    return res.status(existente ? 200 : 201).json({
      ...pagamento.rows[0],
      message: 'Pagamento em dinheiro registrado para recebimento na barbearia.',
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (['ITENS_INVALIDOS', 'SACOLA_VAZIA'].includes(err.code)) {
      return res.status(400).json({ message: err.message })
    }
    if (err.code === 'PRODUTO_INDISPONIVEL') {
      return res.status(409).json({ message: err.message })
    }
    registrarErro('Erro ao registrar pagamento em dinheiro:', err)
    return res.status(500).json({ message: 'Não foi possível registrar o pagamento em dinheiro.' })
  } finally {
    client.release()
  }
}

async function confirmarPagamentoDinheiro(req, res) {
  if (!idValido(req.params.pagamentoId)) {
    return res.status(400).json({ message: 'Pagamento inválido.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `UPDATE public.pagamento
       SET statuspagamento = 'CONFIRMADO',
           datapagamento = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
           atualizado_em = NOW()
       WHERE idpagamento = $1
         AND metodo = 'DINHEIRO'
         AND statuspagamento = 'PENDENTE'
       RETURNING idpagamento, agendamento_idagendamento, pedido_idpedido,
                 statuspagamento, metodo, valor`,
      [req.params.pagamentoId]
    )
    if (!result.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'O pagamento não está pendente para recebimento em dinheiro.' })
    }

    const pagamento = result.rows[0]
    if (pagamento.pedido_idpedido) {
      await client.query(
        `UPDATE public.pedido SET status = 'CONFIRMADO', atualizado_em = NOW()
         WHERE idpedido = $1 AND status = 'PENDENTE'`,
        [pagamento.pedido_idpedido]
      )
    }
    await client.query('COMMIT')
    solicitarNotificacaoWhatsapp(pagamento.agendamento_idagendamento)
    return res.status(200).json(pagamento)
  } catch (err) {
    await client.query('ROLLBACK')
    registrarErro('Erro ao confirmar pagamento em dinheiro:', err)
    return res.status(500).json({ message: 'Não foi possível confirmar o recebimento em dinheiro.' })
  } finally {
    client.release()
  }
}

module.exports = { registrarPagamentoDinheiro, confirmarPagamentoDinheiro }

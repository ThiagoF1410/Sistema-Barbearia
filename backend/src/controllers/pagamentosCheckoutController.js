const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const { getStripe, idPaymentIntentDaSessao, recuperarSessaoCheckout } = require('../services/stripeService')
const { carregarProdutos, lineItemsStripe, substituirItens, totalProdutos } = require('../services/pedidosService')
const { solicitarNotificacaoWhatsapp } = require('../services/disparoNotificacaoWhatsappService')
const { urlFrontend } = require('../utils/frontendUrlUtils')

const PRAZO_PAGAMENTO_MS = 10 * 60 * 1000
const LEMBRETE_ANTES_MS = 3 * 60 * 1000

async function criarCheckout(req, res) {
  const { agendamentoId, produtos: itensProdutos = [] } = req.body || {}
  if (!idValido(agendamentoId)) {
    return res.status(400).json({ message: 'Informe um agendamento válido.' })
  }

  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true

    // Uma única requisição por agendamento pode consultar/criar checkout por vez.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('checkout_pagamento'), $1::integer)",
      [agendamentoId]
    )

    const agendamentoResult = await client.query(
      `SELECT a.idagendamento, uc.idusuario AS cliente_usuario_id,
              uc.email AS cliente_email, up.nome AS profissional,
              a.servico_nome_snapshot AS servico, a.valor_snapshot AS preco,
              TO_CHAR(a.dataagendamento, 'DD/MM/YYYY') AS data,
              TO_CHAR(a.horario, 'HH24:MI') AS horario,
              a.statusagendamento,
              (a.dataagendamento + a.horario)
                > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' AS futuro
       FROM public.agendamento a
       JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
       JOIN public.usuario uc ON uc.idusuario = c.usuario_idusuario
       JOIN public.profissional p ON p.idprofissional = a.profissional_idprofissional
       JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
       JOIN public.servico s ON s.idservico = a.servico_idservico
       WHERE a.idagendamento = $1 AND uc.idusuario = $2
       FOR UPDATE OF a`,
      [agendamentoId, req.userId]
    )

    if (!agendamentoResult.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Agendamento não encontrado.' })
    }

    const agendamento = agendamentoResult.rows[0]
    if (agendamento.statusagendamento !== 'AGENDADO') {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Somente agendamentos ativos podem ser pagos.' })
    }
    if (!agendamento.futuro) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Não é possível iniciar pagamento para um horário que já passou.' })
    }

    let produtos = await carregarProdutos(client, itensProdutos)

    const pagamentoAtual = await client.query(
      `SELECT idpagamento, stripe_checkout_session_id, statuspagamento, metodo, pedido_idpedido,
              checkout_expira_em
       FROM public.pagamento
       WHERE agendamento_idagendamento = $1
       FOR UPDATE`,
      [agendamentoId]
    )

    if (['CONFIRMADO', 'PAGO'].includes(pagamentoAtual.rows[0]?.statuspagamento)) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      solicitarNotificacaoWhatsapp(agendamentoId)
      return res.status(409).json({ message: 'Este agendamento já está pago.' })
    }
    if (pagamentoAtual.rows[0]?.metodo === 'DINHEIRO'
      && pagamentoAtual.rows[0]?.statuspagamento === 'PENDENTE') {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'Este agendamento será pago em dinheiro na barbearia.' })
    }

    const stripe = getStripe()
    const sessaoExistente = pagamentoAtual.rows[0]?.stripe_checkout_session_id
    if (sessaoExistente) {
      const sessao = await recuperarSessaoCheckout(stripe, sessaoExistente)
      if (sessao?.payment_status === 'paid') {
        await client.query(
          `UPDATE public.pagamento
           SET statuspagamento = 'CONFIRMADO',
               stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
               atualizado_em = NOW()
           WHERE agendamento_idagendamento = $1`,
          [agendamentoId, idPaymentIntentDaSessao(sessao)]
        )
        await client.query('COMMIT')
        transacaoAtiva = false
        solicitarNotificacaoWhatsapp(agendamentoId)
        return res.status(409).json({ message: 'Este agendamento já está pago.' })
      }
      let expiraEmAtual = pagamentoAtual.rows[0]?.checkout_expira_em
      if (sessao?.status === 'open' && sessao.url && !expiraEmAtual) {
        expiraEmAtual = new Date(Date.now() + PRAZO_PAGAMENTO_MS)
        const lembreteLegadoEm = new Date(expiraEmAtual.getTime() - LEMBRETE_ANTES_MS)
        await client.query(
          `UPDATE public.pagamento
           SET checkout_expira_em = $2, expirado_em = NULL, atualizado_em = NOW()
           WHERE agendamento_idagendamento = $1 AND statuspagamento = 'PENDENTE'`,
          [agendamentoId, expiraEmAtual]
        )
        await client.query(
          `INSERT INTO public.whatsapp_notificacao
            (agendamento_idagendamento, tipo, proxima_tentativa_em)
           VALUES ($1, 'RESERVA_PAGAMENTO', NOW()),
                  ($1, 'LEMBRETE_PAGAMENTO', $2)
           ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
          [agendamentoId, lembreteLegadoEm]
        )
      }
      if (sessao?.status === 'open' && sessao.url
        && expiraEmAtual && new Date(expiraEmAtual).getTime() > Date.now()) {
        await client.query('COMMIT')
        transacaoAtiva = false
        solicitarNotificacaoWhatsapp(agendamentoId)
        return res.status(200).json({
          checkoutUrl: sessao.url,
          sessionId: sessao.id,
          expiraEm: expiraEmAtual,
          reutilizada: true,
        })
      }
      if (expiraEmAtual && new Date(expiraEmAtual).getTime() <= Date.now()) {
        await client.query('ROLLBACK')
        transacaoAtiva = false
        return res.status(409).json({ message: 'O prazo deste pagamento expirou. Faça um novo agendamento.' })
      }
      if (
        sessao?.status === 'complete'
        && pagamentoAtual.rows[0]?.statuspagamento !== 'FALHOU'
      ) {
        await client.query('COMMIT')
        transacaoAtiva = false
        return res.status(409).json({ message: 'O pagamento deste agendamento está em processamento.' })
      }
    }

    if (!produtos.length && pagamentoAtual.rows[0]?.pedido_idpedido) {
      const itensExistentes = await client.query(
        `SELECT produto_idservico AS idservico, nome_snapshot AS nome,
                preco_snapshot AS preco, quantidade, subtotal
         FROM public.pedido_item WHERE pedido_idpedido = $1 ORDER BY idpedidoitem`,
        [pagamentoAtual.rows[0].pedido_idpedido]
      )
      produtos = itensExistentes.rows.map((item) => ({
        ...item,
        preco: Number(item.preco),
        quantidade: Number(item.quantidade),
        subtotal: Number(item.subtotal),
      }))
    }

    const totalAdicionais = totalProdutos(produtos)
    const valorTotal = Number((Number(agendamento.preco) + totalAdicionais).toFixed(2))
    const valorServicoCentavos = Math.round(Number(agendamento.preco) * 100)
    const valorCentavos = Math.round(valorTotal * 100)
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos < 50) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(400).json({ message: 'O serviço precisa ter valor mínimo de R$ 0,50 para pagamento online.' })
    }

    let pedidoId = pagamentoAtual.rows[0]?.pedido_idpedido || null
    if (produtos.length) {
      const clientePedido = await client.query(
        'SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1',
        [req.userId]
      )
      const pedidoResult = await client.query(
        `INSERT INTO public.pedido
          (cliente_idcliente, agendamento_idagendamento, tipo, status, total)
         VALUES ($1, $2, 'AGENDAMENTO', 'PENDENTE', $3)
         ON CONFLICT (agendamento_idagendamento) WHERE agendamento_idagendamento IS NOT NULL
         DO UPDATE SET total = EXCLUDED.total, status = 'PENDENTE', atualizado_em = NOW()
         RETURNING idpedido`,
        [clientePedido.rows[0].idcliente, agendamentoId, totalAdicionais]
      )
      pedidoId = pedidoResult.rows[0].idpedido
      await substituirItens(client, pedidoId, produtos)
    }

    const frontend = urlFrontend(req)
    const chaveIdempotencia = `checkout-agendamento-${agendamento.idagendamento}-${sessaoExistente || 'inicial'}`
    const sessao = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: String(agendamento.idagendamento),
        customer_email: agendamento.cliente_email,
        success_url: `${frontend}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontend}/checkout/cancelado?agendamento=${agendamento.idagendamento}`,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: valorServicoCentavos,
            product_data: {
              name: agendamento.servico,
              description: `${agendamento.data} às ${agendamento.horario} com ${agendamento.profissional}`,
            },
          },
        }, ...lineItemsStripe(produtos)],
        metadata: {
          agendamento_id: String(agendamento.idagendamento),
          ...(pedidoId ? { pedido_id: String(pedidoId) } : {}),
          usuario_id: String(req.userId),
          contexto: pedidoId ? 'agendamento_com_produtos' : 'agendamento',
        },
      },
      { idempotencyKey: chaveIdempotencia }
    )

    if (!sessao.url) throw new Error('A Stripe criou uma sessão sem URL de checkout.')

    const expiraEm = pagamentoAtual.rows[0]?.checkout_expira_em
      ? new Date(pagamentoAtual.rows[0].checkout_expira_em)
      : new Date(Date.now() + PRAZO_PAGAMENTO_MS)
    const lembreteEm = new Date(expiraEm.getTime() - LEMBRETE_ANTES_MS)
    const pagamentoSalvo = await client.query(
      `INSERT INTO public.pagamento
        (agendamento_idagendamento, pedido_idpedido, datapagamento, valor, statuspagamento, metodo,
         moeda, stripe_checkout_session_id, checkout_expira_em, expirado_em, atualizado_em)
       VALUES ($1, $2, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
               $3, 'PENDENTE', 'STRIPE', 'brl', $4, $5, NULL, NOW())
       ON CONFLICT (agendamento_idagendamento) DO UPDATE SET
         valor = EXCLUDED.valor,
         pedido_idpedido = EXCLUDED.pedido_idpedido,
         statuspagamento = 'PENDENTE',
          metodo = 'STRIPE',
          moeda = EXCLUDED.moeda,
          stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
          checkout_expira_em = EXCLUDED.checkout_expira_em,
          expirado_em = NULL,
          atualizado_em = NOW()
        WHERE pagamento.statuspagamento NOT IN ('CONFIRMADO', 'PAGO')
        RETURNING idpagamento`,
      [agendamento.idagendamento, pedidoId, valorTotal, sessao.id, expiraEm]
    )

    if (!pagamentoSalvo.rows.length) {
      throw new Error('O pagamento foi confirmado durante a criação do checkout.')
    }

    await client.query(
      `INSERT INTO public.whatsapp_notificacao
        (agendamento_idagendamento, tipo, proxima_tentativa_em)
       VALUES ($1, 'RESERVA_PAGAMENTO', NOW()),
              ($1, 'LEMBRETE_PAGAMENTO', $2)
       ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
      [agendamento.idagendamento, lembreteEm]
    )
    await client.query('COMMIT')
    transacaoAtiva = false
    solicitarNotificacaoWhatsapp(agendamento.idagendamento)
    return res.status(201).json({
      checkoutUrl: sessao.url,
      sessionId: sessao.id,
      expiraEm: expiraEm.toISOString(),
      reutilizada: false,
    })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (['ITENS_INVALIDOS', 'SACOLA_VAZIA'].includes(err.code)) {
      return res.status(400).json({ message: err.message })
    }
    if (err.code === 'PRODUTO_INDISPONIVEL') {
      return res.status(409).json({ message: err.message })
    }
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
    }
    registrarErro('Erro ao criar checkout Stripe:', err)
    return res.status(502).json({ message: 'Não foi possível iniciar o pagamento agora.' })
  } finally {
    client.release()
  }
}

module.exports = { criarCheckout }

const pool = require('../config/db')
const { idValido } = require('../utils/agendaUtils')
const {
  getStripe,
  idPaymentIntentDaSessao,
  recuperarSessaoCheckout,
} = require('../services/stripeService')
const {
  obterProcessadorNotificacoesWhatsapp,
} = require('../services/notificacoesWhatsappService')
const {
  carregarProdutos,
  lineItemsStripe,
  substituirItens,
  totalProdutos,
} = require('../services/pedidosService')

const PRAZO_PAGAMENTO_MS = 10 * 60 * 1000
const LEMBRETE_ANTES_MS = 3 * 60 * 1000

function solicitarNotificacaoWhatsapp(agendamentoId, pedidoId) {
  if (!idValido(agendamentoId) && !idValido(pedidoId)) return
  setImmediate(() => {
    const processador = obterProcessadorNotificacoesWhatsapp()
    const processamento = idValido(agendamentoId)
      ? processador.processarAgendamento(agendamentoId)
      : processador.processarPedido(pedidoId)
    processamento
      .catch((err) => console.warn('Falha ao iniciar notificação do WhatsApp:', {
        codigo: err.code || 'WHATSAPP_NOTIFICATION_ERROR',
      }))
  })
}

function origemDesenvolvimentoValida(valor) {
  try {
    const url = new URL(valor)
    const hostPrivado = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
    return url.protocol === 'http:' && hostPrivado ? url.origin : null
  } catch {
    return null
  }
}

function urlFrontend(req) {
  const configurada = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
  const origem = req.body?.origemRetorno || req.get?.('origin')
  if (origem === configurada) return configurada
  if (process.env.NODE_ENV !== 'production') return origemDesenvolvimentoValida(origem) || configurada
  return configurada
}

function statusDoEvento(evento, sessao) {
  if (
    evento.type === 'checkout.session.async_payment_succeeded'
    || (evento.type === 'checkout.session.completed' && sessao.payment_status === 'paid')
  ) {
    return 'CONFIRMADO'
  }
  if (evento.type === 'checkout.session.async_payment_failed') return 'FALHOU'
  if (evento.type === 'checkout.session.expired') return 'CANCELADO'
  return null
}

async function webhookStripe(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET não está configurado.')
    return res.status(503).json({ message: 'Webhook não configurado.' })
  }

  let evento
  try {
    const stripe = getStripe()
    evento = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      webhookSecret
    )
  } catch (err) {
    console.error('Assinatura inválida no webhook Stripe:', err.message)
    return res.status(400).json({ message: 'Assinatura do webhook inválida.' })
  }

  const tiposAceitos = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ])
  if (!tiposAceitos.has(evento.type)) return res.status(200).json({ recebido: true })

  const sessao = evento.data.object
  const agendamentoId = sessao.metadata?.agendamento_id
  const pedidoId = sessao.metadata?.pedido_id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Serializa entregas repetidas do mesmo evento antes de consultar a tabela
    // de idempotência. O registro só é inserido depois de atualizar o pagamento.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)',
      [evento.id]
    )
    const jaProcessado = await client.query(
      'SELECT 1 FROM public.stripe_evento WHERE stripe_evento_id = $1',
      [evento.id]
    )
    if (jaProcessado.rows.length) {
      await client.query('ROLLBACK')
      if (statusDoEvento(evento, sessao) === 'CONFIRMADO') {
        solicitarNotificacaoWhatsapp(agendamentoId)
      }
      return res.status(200).json({ recebido: true, duplicado: true })
    }

    if (!idValido(agendamentoId) && !idValido(pedidoId)) {
      await client.query('ROLLBACK')
      console.warn(`Evento Stripe ${evento.id} ignorado: sessão sem agendamento válido.`)
      return res.status(200).json({ recebido: true, ignorado: true })
    }

    const statusPagamento = statusDoEvento(evento, sessao)
    const atualizado = await client.query(
      `UPDATE public.pagamento
       SET statuspagamento = CASE
             WHEN $1::text = 'CONFIRMADO' THEN 'CONFIRMADO'
             WHEN statuspagamento = 'CONFIRMADO' THEN 'CONFIRMADO'
             WHEN $1::text IS NULL THEN statuspagamento
             WHEN statuspagamento = 'CANCELADO' THEN 'CANCELADO'
             ELSE $1::text
           END,
            stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
            atualizado_em = NOW()
       WHERE stripe_checkout_session_id = $3
       RETURNING idpagamento, agendamento_idagendamento, pedido_idpedido`,
      [statusPagamento, idPaymentIntentDaSessao(sessao), sessao.id]
    )

    if (!atualizado.rows.length) {
      const err = new Error(`Pagamento da sessão Stripe ${sessao.id} ainda não foi registrado.`)
      err.code = 'PAGAMENTO_STRIPE_NAO_ENCONTRADO'
      throw err
    }

    const pagamentoAtualizado = atualizado.rows[0]
    if (pagamentoAtualizado.agendamento_idagendamento && statusPagamento === 'CONFIRMADO') {
      await client.query(
        `UPDATE public.whatsapp_notificacao
         SET status = 'ENVIADO', message_id = 'IGNORADA_POR_CONFIRMACAO', atualizado_em = NOW()
         WHERE agendamento_idagendamento = $1
           AND tipo IN ('RESERVA_PAGAMENTO', 'LEMBRETE_PAGAMENTO')
           AND status IN ('PENDENTE', 'FALHOU')`,
        [pagamentoAtualizado.agendamento_idagendamento]
      )
    }
    if (pagamentoAtualizado.agendamento_idagendamento && statusPagamento === 'CANCELADO') {
      await client.query(
        `UPDATE public.agendamento SET statusagendamento = 'CANCELADO'
         WHERE idagendamento = $1 AND statusagendamento = 'AGENDADO'`,
        [pagamentoAtualizado.agendamento_idagendamento]
      )
      await client.query(
        `INSERT INTO public.whatsapp_notificacao
          (agendamento_idagendamento, tipo, proxima_tentativa_em)
         VALUES ($1, 'PAGAMENTO_EXPIRADO', NOW())
         ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
        [pagamentoAtualizado.agendamento_idagendamento]
      )
    }
    if (pagamentoAtualizado.pedido_idpedido) {
      await client.query(
        `UPDATE public.pedido
         SET status = CASE
               WHEN $1::text = 'CONFIRMADO' THEN 'CONFIRMADO'
               WHEN status = 'CONFIRMADO' THEN 'CONFIRMADO'
               WHEN $1::text IS NULL THEN status
               ELSE $1::text
             END,
             atualizado_em = NOW()
         WHERE idpedido = $2`,
        [statusPagamento, pagamentoAtualizado.pedido_idpedido]
      )
    }

    await client.query(
      `INSERT INTO public.stripe_evento (stripe_evento_id, tipo)
       VALUES ($1, $2)`,
      [evento.id, evento.type]
    )

    await client.query('COMMIT')
    if (statusPagamento === 'CONFIRMADO') {
      solicitarNotificacaoWhatsapp(pagamentoAtualizado.agendamento_idagendamento, pagamentoAtualizado.pedido_idpedido)
    }
    return res.status(200).json({ recebido: true })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Erro ao processar webhook Stripe:', err)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  } finally {
    client.release()
  }
}

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
    console.error('Erro ao criar checkout Stripe:', err)
    return res.status(502).json({ message: 'Não foi possível iniciar o pagamento agora.' })
  } finally {
    client.release()
  }
}

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
    console.error('Erro ao registrar pagamento em dinheiro:', err)
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
    console.error('Erro ao confirmar pagamento em dinheiro:', err)
    return res.status(500).json({ message: 'Não foi possível confirmar o recebimento em dinheiro.' })
  } finally {
    client.release()
  }
}

async function consultarCheckout(req, res) {
  const { sessionId } = req.params
  if (typeof sessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return res.status(400).json({ message: 'Sessão de pagamento inválida.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pagamentoResult = await client.query(
      `SELECT p.idpagamento, p.agendamento_idagendamento, p.pedido_idpedido, p.statuspagamento
       FROM public.pagamento p
       LEFT JOIN public.agendamento a ON a.idagendamento = p.agendamento_idagendamento
       LEFT JOIN public.pedido pe ON pe.idpedido = p.pedido_idpedido
       JOIN public.cliente c ON c.idcliente = COALESCE(a.cliente_idcliente, pe.cliente_idcliente)
       WHERE p.stripe_checkout_session_id = $1
         AND c.usuario_idusuario = $2
       FOR UPDATE OF p`,
      [sessionId, req.userId]
    )
    if (!pagamentoResult.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Pagamento não encontrado.' })
    }

    const pagamento = pagamentoResult.rows[0]
    let status = pagamento.statuspagamento
    if (status !== 'CONFIRMADO') {
      const stripe = getStripe()
      const sessao = await recuperarSessaoCheckout(stripe, sessionId)
      if (!sessao) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Sessão não encontrada na Stripe.' })
      }

      if (sessao.payment_status === 'paid') status = 'CONFIRMADO'
      else if (!['CANCELADO', 'FALHOU'].includes(status)) {
        status = sessao.status === 'expired' ? 'CANCELADO' : 'PENDENTE'
      }

      await client.query(
        `UPDATE public.pagamento
         SET statuspagamento = $1,
             stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
             atualizado_em = NOW()
         WHERE idpagamento = $3`,
        [status, idPaymentIntentDaSessao(sessao), pagamento.idpagamento]
      )
      if (pagamento.pedido_idpedido) {
        await client.query(
          'UPDATE public.pedido SET status = $1, atualizado_em = NOW() WHERE idpedido = $2',
          [status, pagamento.pedido_idpedido]
        )
      }
    }

    await client.query('COMMIT')
    if (status === 'CONFIRMADO') {
      solicitarNotificacaoWhatsapp(pagamento.agendamento_idagendamento)
    }
    return res.status(200).json({
      sessionId,
      agendamentoId: pagamento.agendamento_idagendamento,
      pedidoId: pagamento.pedido_idpedido,
      statuspagamento: status,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Pagamento online ainda não está configurado.' })
    }
    console.error('Erro ao consultar checkout Stripe:', err)
    return res.status(502).json({ message: 'Não foi possível consultar o pagamento agora.' })
  } finally {
    client.release()
  }
}

module.exports = {
  criarCheckout,
  registrarPagamentoDinheiro,
  confirmarPagamentoDinheiro,
  consultarCheckout,
  webhookStripe,
}

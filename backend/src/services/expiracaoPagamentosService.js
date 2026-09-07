const pool = require('../config/db')
const { getStripe, recuperarSessaoCheckout } = require('./stripeService')

const DEFAULT_INTERVAL_MS = 15_000
const MAX_LOTE = 20

function criarExpiracaoPagamentosService({ db = pool, stripeFactory = getStripe, env = process.env, logger = console } = {}) {
  let temporizador = null
  let processando = false

  async function expirarPagamento(idpagamento) {
    const pagamentoResult = await db.query(
      `SELECT idpagamento, agendamento_idagendamento, pedido_idpedido,
              stripe_checkout_session_id, statuspagamento, metodo, checkout_expira_em
       FROM public.pagamento
       WHERE idpagamento = $1`,
      [idpagamento]
    )
    const pagamento = pagamentoResult.rows[0]
    if (!pagamento
      || pagamento.metodo !== 'STRIPE'
      || pagamento.statuspagamento !== 'PENDENTE'
      || !pagamento.checkout_expira_em
      || !pagamento.stripe_checkout_session_id) {
      return { expirado: false }
    }

    let sessao = null
    try {
      sessao = await recuperarSessaoCheckout(stripeFactory(), pagamento.stripe_checkout_session_id)
      if (sessao?.payment_status === 'paid') {
        const client = await db.connect()
        try {
          await client.query('BEGIN')
          const confirmado = await client.query(
            `UPDATE public.pagamento
             SET statuspagamento = 'CONFIRMADO',
                 stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
                 expirado_em = NULL,
                 atualizado_em = NOW()
             WHERE idpagamento = $1
               AND metodo = 'STRIPE'
               AND statuspagamento = 'PENDENTE'
             RETURNING agendamento_idagendamento, pedido_idpedido`,
            [
              idpagamento,
              typeof sessao.payment_intent === 'string'
                ? sessao.payment_intent
                : sessao.payment_intent?.id || null,
            ]
          )
          if (!confirmado.rows.length) {
            await client.query('ROLLBACK')
            return { expirado: false, confirmado: false }
          }

          const item = confirmado.rows[0]
          if (item.pedido_idpedido) {
            await client.query(
              `UPDATE public.pedido SET status = 'CONFIRMADO', atualizado_em = NOW()
               WHERE idpedido = $1 AND status = 'PENDENTE'`,
              [item.pedido_idpedido]
            )
          }
          if (item.agendamento_idagendamento) {
            await client.query(
              `UPDATE public.whatsapp_notificacao
               SET status = 'ENVIADO', message_id = 'IGNORADA_POR_CONFIRMACAO', atualizado_em = NOW()
               WHERE agendamento_idagendamento = $1
                 AND tipo IN ('RESERVA_PAGAMENTO', 'LEMBRETE_PAGAMENTO')
                 AND status IN ('PENDENTE', 'FALHOU')`,
              [item.agendamento_idagendamento]
            )
            await client.query(
              `INSERT INTO public.whatsapp_notificacao
                (agendamento_idagendamento, tipo, proxima_tentativa_em)
               VALUES ($1, 'PAGAMENTO_CONFIRMADO', NOW())
               ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
              [item.agendamento_idagendamento]
            )
          }
          await client.query('COMMIT')
          return { expirado: false, confirmado: true, ...item }
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      }

      if (new Date(pagamento.checkout_expira_em).getTime() > Date.now()) {
        return { expirado: false }
      }
      if (sessao?.status === 'open') await stripeFactory().checkout.sessions.expire(sessao.id)
      if (sessao?.status === 'complete') return { expirado: false, processando: true }
    } catch (err) {
      logger.warn('Não foi possível expirar imediatamente a sessão Stripe:', {
        idpagamento,
        codigo: err.code || 'STRIPE_EXPIRE_ERROR',
      })
      return { expirado: false, tentarNovamente: true }
    }

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const atualizado = await client.query(
        `UPDATE public.pagamento
         SET statuspagamento = 'CANCELADO', expirado_em = NOW(), atualizado_em = NOW()
         WHERE idpagamento = $1
           AND metodo = 'STRIPE'
           AND statuspagamento = 'PENDENTE'
           AND checkout_expira_em <= NOW()
         RETURNING agendamento_idagendamento, pedido_idpedido`,
        [idpagamento]
      )
      if (!atualizado.rows.length) {
        await client.query('ROLLBACK')
        return { expirado: false }
      }

      const item = atualizado.rows[0]
      if (item.agendamento_idagendamento) {
        await client.query(
          `UPDATE public.agendamento
           SET statusagendamento = 'CANCELADO'
           WHERE idagendamento = $1 AND statusagendamento = 'AGENDADO'`,
          [item.agendamento_idagendamento]
        )
        await client.query(
          `UPDATE public.whatsapp_notificacao
           SET status = 'ENVIADO', message_id = 'IGNORADA_POR_EXPIRACAO', atualizado_em = NOW()
           WHERE agendamento_idagendamento = $1
             AND tipo IN ('RESERVA_PAGAMENTO', 'LEMBRETE_PAGAMENTO')
             AND status IN ('PENDENTE', 'FALHOU')`,
          [item.agendamento_idagendamento]
        )
        await client.query(
          `INSERT INTO public.whatsapp_notificacao
            (agendamento_idagendamento, tipo, proxima_tentativa_em)
           VALUES ($1, 'PAGAMENTO_EXPIRADO', NOW())
           ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING`,
          [item.agendamento_idagendamento]
        )
      }
      if (item.pedido_idpedido) {
        await client.query(
          `UPDATE public.pedido SET status = 'CANCELADO', atualizado_em = NOW()
           WHERE idpedido = $1 AND status = 'PENDENTE'`,
          [item.pedido_idpedido]
        )
      }
      await client.query('COMMIT')
      return { expirado: true, ...item }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async function processarExpirados() {
    if (processando) return
    processando = true
    try {
      const pendentes = await db.query(
        `SELECT idpagamento
         FROM public.pagamento
         WHERE metodo = 'STRIPE'
           AND statuspagamento = 'PENDENTE'
           AND checkout_expira_em IS NOT NULL
           AND stripe_checkout_session_id IS NOT NULL
         ORDER BY (checkout_expira_em <= NOW()) DESC, checkout_expira_em, idpagamento
         LIMIT $1`,
        [MAX_LOTE]
      )
      for (const item of pendentes.rows) await expirarPagamento(item.idpagamento)
    } catch (err) {
      logger.warn('Falha ao reconciliar pagamentos Stripe pendentes:', {
        codigo: err.code || 'PAYMENT_EXPIRATION_ERROR',
      })
    } finally {
      processando = false
    }
  }

  function iniciar() {
    if (temporizador) return
    const intervalo = Number(env.PAYMENT_EXPIRATION_INTERVAL_MS || DEFAULT_INTERVAL_MS)
    temporizador = setInterval(processarExpirados, intervalo)
    temporizador.unref?.()
    setTimeout(processarExpirados, 1_000).unref?.()
  }

  function encerrar() {
    clearInterval(temporizador)
    temporizador = null
  }

  return { iniciar, encerrar, expirarPagamento, processarExpirados }
}

let processadorPadrao
function obterProcessadorExpiracaoPagamentos() {
  processadorPadrao ||= criarExpiracaoPagamentosService()
  return processadorPadrao
}

module.exports = { criarExpiracaoPagamentosService, obterProcessadorExpiracaoPagamentos }

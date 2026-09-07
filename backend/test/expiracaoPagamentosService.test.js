const test = require('node:test')
const assert = require('node:assert/strict')
const { criarExpiracaoPagamentosService } = require('../src/services/expiracaoPagamentosService')

function criarDbFake(pagamento) {
  const consultas = []
  const client = {
    async query(sql, parametros) {
      consultas.push({ sql, parametros })
      if (sql.includes('UPDATE public.pagamento') && sql.includes('RETURNING agendamento')) {
        return { rows: [{ agendamento_idagendamento: 9, pedido_idpedido: null }] }
      }
      return { rows: [] }
    },
    release() {},
  }
  return {
    consultas,
    async query(sql) {
      consultas.push({ sql })
      if (sql.includes('FROM public.pagamento') && sql.includes('WHERE idpagamento')) {
        return { rows: [pagamento] }
      }
      return { rows: [] }
    },
    async connect() { return client },
  }
}

test('expira pagamento on-line vencido e libera o agendamento', async () => {
  const db = criarDbFake({
    idpagamento: 4,
    agendamento_idagendamento: 9,
    pedido_idpedido: null,
    stripe_checkout_session_id: 'cs_test_123',
    statuspagamento: 'PENDENTE',
    metodo: 'STRIPE',
    checkout_expira_em: new Date(Date.now() - 1000),
  })
  const expiradas = []
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() { return { id: 'cs_test_123', status: 'open', payment_status: 'unpaid' } },
        async expire(id) { expiradas.push(id) },
      },
    },
  }
  const service = criarExpiracaoPagamentosService({
    db,
    stripeFactory: () => stripe,
    logger: { warn() {} },
  })

  const resultado = await service.expirarPagamento(4)

  assert.equal(resultado.expirado, true)
  assert.deepEqual(expiradas, ['cs_test_123'])
  assert.equal(db.consultas.some((item) => item.sql.includes('UPDATE public.agendamento')), true)
  assert.equal(db.consultas.some((item) => item.sql.includes("'PAGAMENTO_EXPIRADO'")), true)
})

test('não cancela quando a Stripe já identificou o pagamento', async () => {
  const db = criarDbFake({
    idpagamento: 5,
    agendamento_idagendamento: 10,
    stripe_checkout_session_id: 'cs_test_pago',
    statuspagamento: 'PENDENTE',
    metodo: 'STRIPE',
    checkout_expira_em: new Date(Date.now() - 1000),
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() { return { id: 'cs_test_pago', status: 'complete', payment_status: 'paid' } },
      },
    },
  }
  const service = criarExpiracaoPagamentosService({ db, stripeFactory: () => stripe })

  const resultado = await service.expirarPagamento(5)

  assert.equal(resultado.expirado, false)
  assert.equal(resultado.confirmado, true)
  assert.equal(db.consultas.some((item) => item.sql.includes("statuspagamento = 'CONFIRMADO'")), true)
  assert.equal(db.consultas.some((item) => item.sql.includes("'PAGAMENTO_CONFIRMADO'")), true)
})

test('reconcilia pagamento confirmado antes do vencimento', async () => {
  const db = criarDbFake({
    idpagamento: 6,
    agendamento_idagendamento: 11,
    stripe_checkout_session_id: 'cs_test_pago_antes',
    statuspagamento: 'PENDENTE',
    metodo: 'STRIPE',
    checkout_expira_em: new Date(Date.now() + 60_000),
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() {
          return {
            id: 'cs_test_pago_antes',
            status: 'complete',
            payment_status: 'paid',
            payment_intent: 'pi_test_123',
          }
        },
      },
    },
  }
  const service = criarExpiracaoPagamentosService({ db, stripeFactory: () => stripe })

  const resultado = await service.expirarPagamento(6)

  assert.equal(resultado.confirmado, true)
  assert.equal(db.consultas.some((item) => item.parametros?.includes('pi_test_123')), true)
})

const test = require('node:test')
const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres'
process.env.DATABASE_URL = 'postgresql://teste:teste@localhost:5432/barbearia_teste'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.WHATSAPP_ENABLED = 'false'
process.env.WHATSAPP_TEST_ENDPOINT_ENABLED = 'false'

const { app } = require('../server')

async function comServidor(executar) {
  const servidor = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => servidor.once('listening', resolve))
  const { port } = servidor.address()
  try {
    await executar(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => servidor.close((err) => err ? reject(err) : resolve()))
  }
}

test('rotas financeiras administrativas exigem autenticação', async () => {
  await comServidor(async (url) => {
    for (const caminho of ['/api/pagamentos/admin', '/api/pagamentos/admin/relatorio-mensal?ano=2026']) {
      const resposta = await fetch(`${url}${caminho}`)
      assert.equal(resposta.status, 401)
      assert.deepEqual(await resposta.json(), { message: 'Token não informado.' })
    }
  })
})

test('checkout também permanece restrito sem token de cliente', async () => {
  await comServidor(async (url) => {
    for (const caminho of [
      '/api/pagamentos/checkout',
      '/api/pagamentos/dinheiro',
      '/api/pedidos/checkout',
      '/api/pedidos/dinheiro',
    ]) {
      const resposta = await fetch(`${url}${caminho}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agendamentoId: 1 }),
      })
      assert.equal(resposta.status, 401)
    }
  })
})

test('confirmação administrativa de dinheiro exige autenticação', async () => {
  await comServidor(async (url) => {
    const resposta = await fetch(`${url}/api/pagamentos/admin/1/confirmar-dinheiro`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    assert.equal(resposta.status, 401)
  })
})

test('atualização do perfil exige autenticação', async () => {
  await comServidor(async (url) => {
    const resposta = await fetch(`${url}/api/auth/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Cliente', email: 'cliente@example.com', telefone: '11999999999' }),
    })
    assert.equal(resposta.status, 401)
    assert.deepEqual(await resposta.json(), { message: 'Token não informado.' })
  })
})

test('origem não autorizada recebe resposta 403 sem detalhes internos', async () => {
  const original = console.error
  console.error = () => {}
  try {
    await comServidor(async (url) => {
      const resposta = await fetch(`${url}/`, { headers: { origin: 'https://origem-invalida.example' } })
      assert.equal(resposta.status, 403)
      assert.deepEqual(await resposta.json(), { message: 'Origem não autorizada.' })
    })
  } finally {
    console.error = original
  }
})

test('JSON inválido é tratado com resposta 400', async () => {
  const original = console.error
  console.error = () => {}
  try {
    await comServidor(async (url) => {
      const resposta = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"email":',
      })
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), { message: 'JSON inválido.' })
    })
  } finally {
    console.error = original
  }
})

test('API oculta tecnologia e envia cabeçalhos de segurança', async () => {
  await comServidor(async (url) => {
    const resposta = await fetch(`${url}/`)
    assert.equal(resposta.status, 200)
    assert.equal(resposta.headers.get('x-powered-by'), null)
    assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(resposta.headers.get('x-frame-options'), 'DENY')
    assert.equal(resposta.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(resposta.headers.get('cache-control'), 'no-store')
    assert.match(resposta.headers.get('content-security-policy'), /default-src 'none'/)
    assert.match(resposta.headers.get('permissions-policy'), /microphone=\(\)/)
  })
})

test('JSON acima de 32 kB é recusado com resposta formal 413', async () => {
  const original = console.error
  console.error = () => {}
  try {
    await comServidor(async (url) => {
      const resposta = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'cliente@example.com', password: 'a'.repeat(33 * 1024) }),
      })
      assert.equal(resposta.status, 413)
      assert.deepEqual(await resposta.json(), { message: 'O conteúdo enviado excede o limite permitido.' })
    })
  } finally {
    console.error = original
  }
})

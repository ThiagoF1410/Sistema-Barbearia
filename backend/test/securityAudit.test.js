const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

const { validarAmbiente } = require('../src/config/env')
const {
  senhaValida,
  signToken,
  verifyToken,
} = require('../src/utils/authUtils')
const { criarCabecalhosSeguros } = require('../src/middlewares/httpsMiddleware')

function comAmbiente(valores, executar) {
  const original = { ...process.env }
  Object.assign(process.env, valores)
  try {
    return executar()
  } finally {
    for (const chave of Object.keys(process.env)) {
      if (!(chave in original)) delete process.env[chave]
    }
    Object.assign(process.env, original)
  }
}

const ambienteProducao = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://usuario:senha@db.example.com:5432/barbearia',
  JWT_SECRET: 'segredo-aleatorio-com-mais-de-trinta-e-dois-caracteres',
  JWT_ACCESS_EXPIRES_IN: '15m',
  FRONTEND_URL: 'https://barbearia.example.com',
  STRIPE_MODE: 'live',
  STRIPE_SECRET_KEY: 'sk_live_exemplo_apenas_para_validacao_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_exemplo_apenas_para_validacao_123',
  EMAIL_USER: 'contato@example.com',
  EMAIL_PASS: 'senha-de-aplicativo',
  WHATSAPP_ENABLED: 'false',
  WHATSAPP_TEST_ENDPOINT_ENABLED: 'false',
}

test('aplica os limites seguros de entrada do bcrypt', () => {
  assert.equal(senhaValida('CactoVerde27'), true)
  assert.equal(senhaValida('ABCDEFGHIJ12!'), true)
  assert.equal(senhaValida('cactoverde27'), false)
  assert.equal(senhaValida('Password123!'), false)
  assert.equal(senhaValida('Cacto Verde27!'), false)
  assert.equal(senhaValida('CáctoVerde27!'), false)
  assert.equal(senhaValida('CactoVerde27🔐'), false)
  assert.equal(senhaValida('NavalhaSegura27!'), true)
  assert.equal(senhaValida('ThiagoSeguro27!'), true)
  assert.equal(senhaValida('ClientePch27!'), true)
  assert.equal(senhaValida('Curta27!'), false)
  assert.equal(senhaValida('a'.repeat(73)), false)
  assert.equal(senhaValida('🔐'.repeat(19)), false)
})

test('JWT usa HS256, emissor, audiência e expiração', () => {
  comAmbiente({
    JWT_SECRET: ambienteProducao.JWT_SECRET,
    JWT_ACCESS_EXPIRES_IN: '15m',
  }, () => {
    const token = signToken({ id: 10, tokenVersion: 2, role: 'cliente' })
    const cabecalho = jwt.decode(token, { complete: true }).header
    const payload = verifyToken(token)
    assert.equal(cabecalho.alg, 'HS256')
    assert.equal(payload.iss, 'rei-da-navalha-api')
    assert.equal(payload.aud, 'rei-da-navalha-web')
    assert.ok(payload.exp > payload.iat)
  })
})

test('rejeita JWT sem emissor e audiência esperados', () => {
  comAmbiente({ JWT_SECRET: ambienteProducao.JWT_SECRET }, () => {
    const tokenIncompatível = jwt.sign({ id: 10, tokenVersion: 2 }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '15m',
    })
    assert.throws(() => verifyToken(tokenIncompatível))
  })
})

test('aceita uma configuração de produção completa e segura', () => {
  comAmbiente(ambienteProducao, () => {
    const resultado = validarAmbiente()
    assert.equal(resultado.isProduction, true)
    assert.equal(resultado.frontendUrl, 'https://barbearia.example.com')
  })
})

test('rejeita segredo de exemplo e duração JWT fora da política', () => {
  comAmbiente({ ...ambienteProducao, JWT_SECRET: 'troque-esta-chave-por-uma-segura-com-32-caracteres' }, () => {
    assert.throws(() => validarAmbiente(), /valor de exemplo/)
  })
  comAmbiente({ ...ambienteProducao, JWT_ACCESS_EXPIRES_IN: '90d' }, () => {
    assert.throws(() => validarAmbiente(), /JWT_ACCESS_EXPIRES_IN/)
  })
})

test('rejeita produção sem HTTPS ou sem segredo do webhook', () => {
  comAmbiente({ ...ambienteProducao, FRONTEND_URL: 'http://barbearia.example.com' }, () => {
    assert.throws(() => validarAmbiente(), /HTTPS/)
  })
  comAmbiente({ ...ambienteProducao, STRIPE_WEBHOOK_SECRET: '' }, () => {
    assert.throws(() => validarAmbiente(), /STRIPE_WEBHOOK_SECRET/)
  })
})

test('rede privada exige liberação explícita e nunca é habilitada em produção', () => {
  comAmbiente({ ...ambienteProducao, CORS_ALLOW_PRIVATE_NETWORK: 'true' }, () => {
    assert.equal(validarAmbiente().allowPrivateNetworkOrigins, false)
  })

  comAmbiente({
    ...ambienteProducao,
    NODE_ENV: 'development',
    FRONTEND_URL: 'http://localhost:5173',
    STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_exemplo_apenas_para_validacao_123',
    CORS_ALLOW_PRIVATE_NETWORK: 'true',
  }, () => {
    assert.equal(validarAmbiente().allowPrivateNetworkOrigins, true)
  })
})

test('aplica cabeçalhos contra cache, iframe, MIME sniffing e recursos indevidos', () => {
  const cabecalhos = new Map()
  const resposta = { setHeader: (nome, valor) => cabecalhos.set(nome, valor) }
  let avancou = false
  criarCabecalhosSeguros(true)({ secure: true }, resposta, () => { avancou = true })

  assert.equal(avancou, true)
  assert.equal(cabecalhos.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(cabecalhos.get('X-Frame-Options'), 'DENY')
  assert.equal(cabecalhos.get('Cache-Control'), 'no-store')
  assert.match(cabecalhos.get('Content-Security-Policy'), /default-src 'none'/)
  assert.match(cabecalhos.get('Permissions-Policy'), /camera=\(\)/)
  assert.match(cabecalhos.get('Strict-Transport-Security'), /max-age=31536000/)
})

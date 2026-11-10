const test = require('node:test')
const assert = require('node:assert/strict')
const {
  origemDesenvolvimentoValida,
  urlFrontend,
} = require('../src/utils/frontendUrlUtils')

function requisicao(origemRetorno, origin) {
  return {
    body: origemRetorno ? { origemRetorno } : {},
    get: (cabecalho) => cabecalho === 'origin' ? origin : undefined,
  }
}

test('aceita apenas origens HTTP locais ou privadas no desenvolvimento', () => {
  assert.equal(origemDesenvolvimentoValida('http://localhost:5173'), 'http://localhost:5173')
  assert.equal(origemDesenvolvimentoValida('http://192.168.15.2:5173'), 'http://192.168.15.2:5173')
  assert.equal(origemDesenvolvimentoValida('http://10.0.0.20:5173'), 'http://10.0.0.20:5173')
  assert.equal(origemDesenvolvimentoValida('https://example.com'), null)
  assert.equal(origemDesenvolvimentoValida('valor-invalido'), null)
})

test('usa a origem privada informada no desenvolvimento', () => {
  const nodeEnv = process.env.NODE_ENV
  const frontendUrl = process.env.FRONTEND_URL
  process.env.NODE_ENV = 'development'
  process.env.FRONTEND_URL = 'http://localhost:5173/'
  try {
    assert.equal(
      urlFrontend(requisicao('http://192.168.1.25:5173')),
      'http://192.168.1.25:5173'
    )
  } finally {
    process.env.NODE_ENV = nodeEnv
    process.env.FRONTEND_URL = frontendUrl
  }
})

test('ignora origem externa e fixa a URL configurada em producao', () => {
  const nodeEnv = process.env.NODE_ENV
  const frontendUrl = process.env.FRONTEND_URL
  process.env.NODE_ENV = 'production'
  process.env.FRONTEND_URL = 'https://barbearia.example/'
  try {
    assert.equal(
      urlFrontend(requisicao(undefined, 'https://origem-maliciosa.example')),
      'https://barbearia.example'
    )
  } finally {
    process.env.NODE_ENV = nodeEnv
    process.env.FRONTEND_URL = frontendUrl
  }
})

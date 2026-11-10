const test = require('node:test')
const assert = require('node:assert/strict')

const {
  POLITICAS_SESSAO,
  hashToken,
  lerCookie,
  sessaoAindaValida,
} = require('../src/services/sessaoAutenticacaoService')

test('políticas de sessão respeitam os limites definidos por perfil', () => {
  assert.equal(POLITICAS_SESSAO.cliente.duracaoMaximaMs, 7 * 24 * 60 * 60 * 1000)
  assert.equal(POLITICAS_SESSAO.cliente.inatividadeMs, null)
  assert.equal(POLITICAS_SESSAO.profissional.duracaoMaximaMs, 12 * 60 * 60 * 1000)
  assert.equal(POLITICAS_SESSAO.profissional.inatividadeMs, 2 * 60 * 60 * 1000)
  assert.equal(POLITICAS_SESSAO.admin.duracaoMaximaMs, 8 * 60 * 60 * 1000)
  assert.equal(POLITICAS_SESSAO.admin.inatividadeMs, 2 * 60 * 60 * 1000)
})

test('refresh token é comparado somente pelo hash', () => {
  const token = 'token-secreto-de-teste'
  const hash = hashToken(token)
  assert.equal(hash.length, 64)
  assert.notEqual(hash, token)
  assert.equal(hashToken(token), hash)
})

test('cookie de renovação é lido sem aceitar valor malformado', () => {
  assert.equal(lerCookie({ headers: { cookie: 'tema=dark; orn_refresh=abc123; outro=1' } }), 'abc123')
  assert.equal(lerCookie({ headers: {} }), null)
  assert.equal(lerCookie({ headers: { cookie: 'orn_refresh=%E0%A4%A' } }), null)
})

test('sessão administrativa expira por inatividade e pelo limite absoluto', () => {
  const agora = Date.now()
  const base = {
    perfil: 'admin',
    ultima_atividade_em: new Date(agora - 30 * 60 * 1000),
    expira_em: new Date(agora + 60 * 60 * 1000),
    revogada_em: null,
  }
  assert.equal(sessaoAindaValida(base, agora), true)
  assert.equal(sessaoAindaValida({ ...base, ultima_atividade_em: new Date(agora - 3 * 60 * 60 * 1000) }, agora), false)
  assert.equal(sessaoAindaValida({ ...base, expira_em: new Date(agora - 1) }, agora), false)
  assert.equal(sessaoAindaValida({ ...base, revogada_em: new Date() }, agora), false)
})

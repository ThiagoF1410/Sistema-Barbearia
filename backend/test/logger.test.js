const test = require('node:test')
const assert = require('node:assert/strict')

const { textoSeguro, resumirErro } = require('../src/utils/logger')

test('textoSeguro remove quebras de linha e limita o conteúdo', () => {
  assert.equal(textoSeguro('primeira\nsegunda\tterceira'), 'primeira segunda terceira')
  assert.equal(textoSeguro('abcdef', 4), 'abcd')
})

test('resumirErro não expõe mensagem quando desabilitada', () => {
  const erro = Object.assign(new Error('SQL e dados internos'), { code: '23505' })
  assert.deepEqual(resumirErro(erro, { incluirMensagem: false }), {
    tipo: 'Error',
    codigo: '23505',
  })
})

test('resumirErro sanitiza mensagem e códigos inesperados', () => {
  const erro = Object.assign(new Error('linha 1\nlinha 2'), { code: 'código inválido!' })
  assert.deepEqual(resumirErro(erro, { incluirMensagem: true }), {
    tipo: 'Error',
    codigo: 'ERRO_INTERNO',
    mensagem: 'linha 1 linha 2',
  })
})


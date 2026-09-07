const test = require('node:test')
const assert = require('node:assert/strict')
const { validarDadosPerfil } = require('../src/controllers/auth/contasController')

test('normaliza os dados válidos de atualização do perfil', () => {
  assert.deepEqual(validarDadosPerfil({
    nome: '  Matheus   Francisco ',
    email: ' MATHEUS@EXAMPLE.COM ',
    telefone: '(11) 99999-9999',
  }), {
    dados: {
      nome: 'Matheus Francisco',
      email: 'matheus@example.com',
      telefone: '11999999999',
    },
  })
})

test('recusa e-mail inválido na atualização do perfil', () => {
  assert.equal(validarDadosPerfil({
    nome: 'Matheus Francisco', email: 'email-invalido', telefone: '11999999999',
  }).erro, 'Informe um e-mail válido.')
})

test('recusa telefone sem DDD válido na atualização do perfil', () => {
  assert.equal(validarDadosPerfil({
    nome: 'Matheus Francisco', email: 'matheus@example.com', telefone: '9999-9999',
  }).erro, 'Informe um telefone com DDD válido.')
})

test('recusa campos obrigatórios ausentes na atualização do perfil', () => {
  assert.equal(validarDadosPerfil({ nome: '', email: '', telefone: '' }).erro,
    'Preencha nome, e-mail e telefone.')
})

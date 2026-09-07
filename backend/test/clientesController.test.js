const test = require('node:test')
const assert = require('node:assert/strict')
const { validarDadosCliente } = require('../src/controllers/clientesController')

test('normaliza os dados válidos de um cliente', () => {
  assert.deepEqual(validarDadosCliente({
    nome: '  Matheus   Francisco ',
    email: ' MATHEUS@EXEMPLO.COM ',
    telefone: '(18) 99999-9999',
  }), {
    nome: 'Matheus Francisco',
    email: 'matheus@exemplo.com',
    telefone: '18999999999',
  })
})

test('recusa nome inválido na gestão de clientes', () => {
  assert.match(validarDadosCliente({ nome: 'M', email: 'm@exemplo.com', telefone: '18999999999' }).erro, /nome/i)
})

test('recusa e-mail inválido na gestão de clientes', () => {
  assert.match(validarDadosCliente({ nome: 'Matheus', email: 'inválido', telefone: '18999999999' }).erro, /e-mail/i)
})

test('recusa telefone sem DDD na gestão de clientes', () => {
  assert.match(validarDadosCliente({ nome: 'Matheus', email: 'm@exemplo.com', telefone: '99999999' }).erro, /telefone/i)
})

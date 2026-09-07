const test = require('node:test')
const assert = require('node:assert/strict')
const { validarProfissional } = require('../src/controllers/profissionaisController')

test('valida e normaliza os dados de um profissional', () => {
  const resultado = validarProfissional({
    nome: '  Lucas Barbeiro  ',
    email: '  LUCAS@EXEMPLO.COM  ',
    especialidade: '  Corte e barba  ',
    password: 'Senha@123',
  }, { exigirSenha: true })

  assert.deepEqual(resultado, {
    nome: 'Lucas Barbeiro',
    email: 'lucas@exemplo.com',
    especialidade: 'Corte e barba',
    password: 'Senha@123',
  })
})

test('exige uma senha segura no cadastro', () => {
  const resultado = validarProfissional({
    nome: 'Lucas Barbeiro', email: 'lucas@exemplo.com', especialidade: 'Barbeiro', password: '123',
  }, { exigirSenha: true })
  assert.match(resultado.erro, /senha/i)
})

test('permite manter a senha atual durante a edição', () => {
  const resultado = validarProfissional({
    nome: 'Lucas Barbeiro', email: 'lucas@exemplo.com', especialidade: 'Barbeiro', password: '',
  })
  assert.equal(resultado.erro, undefined)
})

test('rejeita nome, e-mail ou especialidade inválidos', () => {
  assert.ok(validarProfissional({ nome: 'L', email: 'lucas@exemplo.com', especialidade: 'Barbeiro' }).erro)
  assert.ok(validarProfissional({ nome: 'Lucas', email: 'email-invalido', especialidade: 'Barbeiro' }).erro)
  assert.ok(validarProfissional({ nome: 'Lucas', email: 'lucas@exemplo.com', especialidade: 'B' }).erro)
})

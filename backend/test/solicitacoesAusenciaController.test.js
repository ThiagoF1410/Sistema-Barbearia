const test = require('node:test')
const assert = require('node:assert/strict')
const { validarSolicitacao } = require('../src/controllers/agenda/solicitacoesAusenciaController')

test('aceita solicitação válida de folga ou férias', () => {
  assert.equal(validarSolicitacao({
    tipo: 'FOLGA',
    datainicio: '2026-09-10',
    datafim: '2026-09-10',
    motivo: 'Compromisso pessoal',
  }), null)
  assert.equal(validarSolicitacao({
    tipo: 'FERIAS',
    datainicio: '2026-10-01',
    datafim: '2026-10-15',
  }), null)
})

test('recusa tipo, período ou motivo inválidos', () => {
  assert.match(validarSolicitacao({
    tipo: 'FERIADO',
    datainicio: '2026-09-10',
    datafim: '2026-09-10',
  }), /tipo e um período válidos/)
  assert.match(validarSolicitacao({
    tipo: 'FOLGA',
    datainicio: '2026-09-12',
    datafim: '2026-09-10',
  }), /tipo e um período válidos/)
  assert.match(validarSolicitacao({
    tipo: 'FOLGA',
    datainicio: '2026-09-10',
    datafim: '2026-09-10',
    motivo: 'x'.repeat(256),
  }), /no máximo 255 caracteres/)
})

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { lembreteValido, mensagemLembreteAtendimento } = require('../src/services/lembretesAtendimentoService')
const agora = Date.parse('2026-09-10T12:00:00Z')
const h = 3600000
function item() { return { receber_lembretes_whatsapp: true, statusagendamento: 'AGENDADO', statuspagamento: 'CONFIRMADO', inicio_atendimento: new Date(agora + 24*h), lembrete_inicio: new Date(agora + 24*h), lembrete_reservado_em: new Date(agora - 4*h) } }
test('lembrete de 24h e dinheiro pendente são elegíveis', () => {
  assert.equal(lembreteValido(item(), agora), true)
  assert.equal(lembreteValido({...item(), metodo:'DINHEIRO', statuspagamento:'PENDENTE'}, agora), true)
})
test('cancela envio para cancelamento, remarcação, opt-out, atraso e online pendente', () => {
  for (const alteracao of [{statusagendamento:'CANCELADO'}, {receber_lembretes_whatsapp:false}, {lembrete_inicio:new Date(agora)}, {statuspagamento:'PENDENTE',metodo:'STRIPE'}]) assert.equal(lembreteValido({...item(),...alteracao},agora),false)
  assert.equal(lembreteValido(item(),agora+2*h),false)
})
test('12h só para reserva com menos de 24h de antecedência', () => {
  const curto={...item(),inicio_atendimento:new Date(agora+12*h),lembrete_inicio:new Date(agora+12*h)}
  assert.equal(lembreteValido(curto,agora),true)
  assert.equal(lembreteValido({...curto,lembrete_reservado_em:new Date(agora-30*h)},agora),false)
})
test('usa a janela de 12h como contingência quando o aviso de 24h não foi enviado', () => {
  const contingencia = {
    ...item(),
    tipo: 'LEMBRETE_ATENDIMENTO_1789056000_12H',
    inicio_atendimento: new Date(agora + 12*h),
    lembrete_inicio: new Date(agora + 12*h),
    lembrete_reservado_em: new Date(agora - 30*h),
  }
  assert.equal(lembreteValido(contingencia, agora), true)
})
test('mensagem inclui informações, horário de Brasília e link', () => {
  const msg=mensagemLembreteAtendimento({cliente:'Ana Silva',data:'11/09/2026',horario:'09:00',servico:'Corte',profissional:'Lucas',produtos:'1× Balm, 2× Shampoo'},'https://example.com/')
  assert.match(msg,/Ana/);assert.match(msg,/Brasília/);assert.match(msg,/1× Balm/);assert.match(msg,/https:\/\/example.com\/historico/)
})

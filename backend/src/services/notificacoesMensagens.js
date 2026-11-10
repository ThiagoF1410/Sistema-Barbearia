function campoMensagem(valor, fallback, limite = 100) {
  const limpo = String(valor || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(limpo || fallback).slice(0, limite).join('')
}

function mensagemConfirmacao({ cliente, servico, data, horario, profissional } = {}) {
  const primeiroNome = campoMensagem(cliente, 'cliente').split(' ')[0]
  const servicoSeguro = campoMensagem(servico, 'Serviço agendado')
  const dataSegura = campoMensagem(data, 'não informada', 10)
  const horarioSeguro = campoMensagem(horario, 'não informado', 5)
  const profissionalSeguro = campoMensagem(profissional, 'Profissional da barbearia')

  return [
    '✦ *O Rei da Navalha* ✦',
    '',
    `Olá, *${primeiroNome}*! 💈`,
    '',
    '✅ *Pagamento confirmado!*',
    'Seu horário está reservado com sucesso.',
    '',
    '━━━━━━━━━━━━━━',
    `✂️ *Serviço:* ${servicoSeguro}`,
    `📅 *Data:* ${dataSegura}`,
    `🕒 *Horário:* ${horarioSeguro}`,
    `👤 *Profissional:* ${profissionalSeguro}`,
    '━━━━━━━━━━━━━━',
    '',
    'Obrigado pela preferência. Aguardamos você! 👑',
  ].join('\n')
}

function mensagemReservaOnline(dados = {}) {
  const primeiroNome = campoMensagem(dados.cliente, 'cliente').split(' ')[0]
  return [
    '✂️ *O Rei da Navalha*',
    '',
    `Olá, ${primeiroNome}! Seu horário foi reservado temporariamente.`,
    '',
    `✂️ *Serviço:* ${campoMensagem(dados.servico, 'Serviço agendado')}`,
    `📅 *Data:* ${campoMensagem(dados.data, 'não informada', 10)}`,
    `⏰ *Horário:* ${campoMensagem(dados.horario, 'não informado', 5)}`,
    `💈 *Profissional:* ${campoMensagem(dados.profissional, 'Profissional da barbearia')}`,
    `💵 *Valor:* ${campoMensagem(dados.valor_formatado, 'não informado', 30)}`,
    '',
    `⌛ Conclua o pagamento até *${campoMensagem(dados.limite, 'o horário informado', 5)}*.`,
    '',
    '🔗 *Pagar agora:*',
    campoMensagem(dados.checkout_url, 'Link indisponível', 1000),
    '',
    'Após esse prazo, o horário será liberado automaticamente.',
  ].join('\n')
}

function mensagemLembrete(dados = {}) {
  return [
    '⏳ *Seu prazo está terminando!*',
    '',
    'Faltam aproximadamente *3 minutos* para confirmar seu agendamento.',
    '',
    '🔗 *Finalize o pagamento:*',
    campoMensagem(dados.checkout_url, 'Link indisponível', 1000),
    '',
    'Caso o pagamento já tenha sido realizado, desconsidere esta mensagem.',
    '*O Rei da Navalha* ✂️',
  ].join('\n')
}

function mensagemExpirada({ cliente } = {}) {
  const primeiroNome = campoMensagem(cliente, 'cliente').split(' ')[0]
  return [
    '⌛ *Prazo de pagamento encerrado*',
    '',
    `Olá, ${primeiroNome}. O pagamento não foi identificado dentro do prazo e o horário foi liberado.`,
    '',
    '📅 Para escolher um novo horário, acesse:',
    `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/agendar`,
    '',
    '*O Rei da Navalha* ✂️',
  ].join('\n')
}

function mensagemReservaDinheiro(dados = {}) {
  const primeiroNome = campoMensagem(dados.cliente, 'cliente').split(' ')[0]
  return [
    '✂️ *O Rei da Navalha*',
    '',
    `Olá, ${primeiroNome}! Seu horário foi reservado.`,
    '',
    `✂️ *Serviço:* ${campoMensagem(dados.servico, 'Serviço agendado')}`,
    `📅 *Data:* ${campoMensagem(dados.data, 'não informada', 10)}`,
    `⏰ *Horário:* ${campoMensagem(dados.horario, 'não informado', 5)}`,
    `💈 *Profissional:* ${campoMensagem(dados.profissional, 'Profissional da barbearia')}`,
    '💵 *Pagamento:* Dinheiro na barbearia',
    '',
    'Seu agendamento está registrado. Aguardamos você! ✅',
  ].join('\n')
}

function mensagemPedidoConfirmado({ cliente, pedido, itens, valor_formatado } = {}) {
  const primeiroNome = campoMensagem(cliente, 'cliente').split(' ')[0]
  return [
    '🛍️ *O Rei da Navalha*',
    '',
    `Olá, *${primeiroNome}*! ✅`,
    '',
    '✨ *Pagamento do seu pedido confirmado!*',
    'Seu pedido já está separado para retirada na barbearia.',
    '',
    '━━━━━━━━━━━━━━━━',
    `📦 *Pedido:* #${campoMensagem(pedido, '—', 20)}`,
    `🧴 *Itens:* ${campoMensagem(itens, 'Produtos selecionados', 700)}`,
    `💰 *Total pago:* ${campoMensagem(valor_formatado, 'não informado', 30)}`,
    `📍 *Retirada:* na barbearia`,
    '━━━━━━━━━━━━━━━━',
    '',
    'Obrigado pela preferência! 👑',
  ].join('\n')
}

module.exports = {
  campoMensagem,
  mensagemConfirmacao,
  mensagemReservaOnline,
  mensagemLembrete,
  mensagemExpirada,
  mensagemReservaDinheiro,
  mensagemPedidoConfirmado,
}


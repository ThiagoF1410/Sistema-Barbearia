export function criarMensagemAtendimento(assunto, nome) {
  const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || 'cliente'
  return [
    'Olá, equipe O Rei da Navalha! ✂️',
    '',
    `Meu nome é *${primeiroNome}* e gostaria da ajuda de vocês.`,
    '',
    `✦ *Tipo de atendimento:* ${assunto.marcador}`,
    '',
    assunto.orientacao,
    '',
    '☑️ *Para facilitar o atendimento, seguem os dados:*',
    ...assunto.campos.map((campo) => `• *${campo}:* `),
    '',
    'Obrigado! Fico no aguardo do retorno da equipe. ☺️',
  ].join('\n')
}

export function criarUrlAtendimento(telefone, mensagem) {
  const numero = String(telefone || '').replace(/\D/g, '')
  const url = new URL('https://api.whatsapp.com/send')
  url.searchParams.set('phone', numero)
  url.searchParams.set('text', mensagem)
  return url.toString()
}

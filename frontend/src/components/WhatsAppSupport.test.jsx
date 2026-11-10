import { describe, expect, it } from 'vitest'
import { criarMensagemAtendimento, criarUrlAtendimento } from '../utils/whatsappSupportMessage'

describe('mensagem do atendimento pelo WhatsApp', () => {
  it('gera uma solicitação natural, com emojis e sem protocolo técnico', () => {
    const mensagem = criarMensagemAtendimento({
      marcador: 'Reagendamento',
      orientacao: 'Gostaria de remarcar meu atendimento.',
      campos: ['Data e horário atuais', 'Nova data ou horário desejado'],
    }, 'Thiago Francisco')

    expect(mensagem).toContain('Olá, equipe O Rei da Navalha! ✂️')
    expect(mensagem).toContain('Meu nome é *Thiago*')
    expect(mensagem).toContain('✦ *Tipo de atendimento:* Reagendamento')
    expect(mensagem.indexOf('Tipo de atendimento')).toBeLessThan(mensagem.indexOf('Gostaria de remarcar'))
    expect(mensagem).not.toContain('Observações adicionais')
    expect(mensagem).not.toContain('Protocolo')
    expect(mensagem).not.toContain('ORN-')
    expect(decodeURIComponent(encodeURIComponent(mensagem))).toBe(mensagem)

    const url = new URL(criarUrlAtendimento('55 (18) 99999-0000', mensagem))
    expect(url.origin + url.pathname).toBe('https://api.whatsapp.com/send')
    expect(url.searchParams.get('phone')).toBe('5518999990000')
    expect(url.searchParams.get('text')).toBe(mensagem)
  })
})

import { describe, expect, it } from 'vitest'
import { analisarSenha } from './passwordStrength'

describe('política de senha', () => {
  it('aceita 3 dos 4 grupos quando os requisitos básicos são atendidos', () => {
    expect(analisarSenha('CactoVerde27').valida).toBe(true)
    expect(analisarSenha('ABCDEFGHIJ12!').valida).toBe(true)
  })

  it('exige pelo menos 3 grupos de caracteres', () => {
    const resultado = analisarSenha('cactoverde27')
    expect(resultado.gruposAtendidos).toBe(2)
    expect(resultado.valida).toBe(false)
  })

  it('recusa espaços, acentos e emojis', () => {
    const comEspaco = analisarSenha('Cacto Verde27!')
    const comAcento = analisarSenha('CáctoVerde27!')
    const comEmoji = analisarSenha('CactoVerde27🔐')

    expect(comEspaco.valida).toBe(false)
    expect(comEspaco.errosCaracteres).toContain('Espaços não são permitidos na senha.')
    expect(comAcento.valida).toBe(false)
    expect(comAcento.errosCaracteres).toContain('Letras com acento não são permitidas. Use letras sem acento.')
    expect(comEmoji.valida).toBe(false)
    expect(comEmoji.errosCaracteres).toContain('Emojis e caracteres não suportados não são permitidos.')
  })

  it('não contabiliza espaços como caracteres no requisito de comprimento', () => {
    const resultado = analisarSenha('Thi@go1     ')
    expect(resultado.requisitos.length).toBe(false)
    expect(resultado.requisitos.allowed).toBe(false)
    expect(resultado.valida).toBe(false)
  })

  it('recusa senha comum sem bloquear nome, e-mail ou termos da barbearia', () => {
    expect(analisarSenha('Password123!').valida).toBe(false)
    expect(analisarSenha('ThiagoSeguro27!').valida).toBe(true)
    expect(analisarSenha('ClientePch27!').valida).toBe(true)
    expect(analisarSenha('NavalhaSegura27!').valida).toBe(true)
  })
})

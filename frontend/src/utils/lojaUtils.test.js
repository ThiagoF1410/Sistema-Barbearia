import { describe, expect, it } from 'vitest'
import {
  categoriaDoProduto,
  dinheiro,
  formatarDataPedido,
  normalizarBusca,
} from './lojaUtils'

describe('utilitarios da loja', () => {
  it('normaliza busca sem acentos e sem alterar a entrada', () => {
    expect(normalizarBusca('\u00d3leo para Barba')).toBe('oleo para barba')
  })

  it('classifica produtos pelas palavras do nome e da descricao', () => {
    expect(categoriaDoProduto({ nome: 'Pente de madeira' })).toBe('acessorios')
    expect(categoriaDoProduto({ nome: 'Balm premium' })).toBe('barba')
    expect(categoriaDoProduto({ nome: 'Pomada modeladora' })).toBe('cabelo')
  })

  it('formata valor monetario e data retornada pela API', () => {
    expect(dinheiro(100)).toMatch(/100,00/)
    expect(formatarDataPedido('07/09/2026 02:34')).toMatch(/07 de setembro de 2026.*02:34/)
  })

  it('preserva uma data em formato desconhecido', () => {
    expect(formatarDataPedido('agora')).toBe('agora')
  })
})

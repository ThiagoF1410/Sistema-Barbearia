import { useCallback, useState } from 'react'

export const CHAVE_CARRINHO = 'rei-da-navalha:carrinho'

function carregarCarrinho() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '{}')
    if (!salvo || typeof salvo !== 'object' || Array.isArray(salvo)) return {}
    return Object.fromEntries(Object.entries(salvo).filter(([id, quantidade]) => (
      /^\d+$/.test(id) && Number.isInteger(quantidade) && quantidade > 0 && quantidade <= 20
    )))
  } catch {
    return {}
  }
}

function persistir(proximo) {
  if (Object.keys(proximo).length) localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(proximo))
  else localStorage.removeItem(CHAVE_CARRINHO)
}

export default function useCarrinho() {
  const [carrinho, setCarrinho] = useState(carregarCarrinho)

  const alterarQuantidade = useCallback((id, diferenca) => {
    setCarrinho((atual) => {
      const quantidade = Math.min(20, Math.max(0, (atual[id] || 0) + diferenca))
      const proximo = { ...atual }
      if (quantidade) proximo[id] = quantidade
      else delete proximo[id]
      persistir(proximo)
      return proximo
    })
  }, [])

  const remover = useCallback((id) => {
    setCarrinho((atual) => {
      const proximo = { ...atual }
      delete proximo[id]
      persistir(proximo)
      return proximo
    })
  }, [])

  const esvaziar = useCallback(() => {
    localStorage.removeItem(CHAVE_CARRINHO)
    setCarrinho({})
  }, [])

  const quantidadeTotal = Object.values(carrinho).reduce((total, quantidade) => total + quantidade, 0)
  return { alterarQuantidade, carrinho, esvaziar, quantidadeTotal, remover }
}

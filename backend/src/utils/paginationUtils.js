const PAGINA_PADRAO = 1
const LIMITE_PADRAO = 12
const LIMITE_MAXIMO = 50

function inteiroPositivo(valor) {
  if (valor === undefined || valor === null || valor === '') return null
  if (!/^\d+$/.test(String(valor))) return NaN
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero > 0 ? numero : NaN
}

function normalizarPaginacao(query = {}, opcoes = {}) {
  const solicitada = query.pagina !== undefined || query.limite !== undefined
  const paginaInformada = inteiroPositivo(query.pagina)
  const limiteInformado = inteiroPositivo(query.limite)
  if (Number.isNaN(paginaInformada) || Number.isNaN(limiteInformado)) {
    return { erro: 'Informe uma página e um limite válidos.' }
  }

  const limiteMaximo = opcoes.limiteMaximo || LIMITE_MAXIMO
  const pagina = paginaInformada || opcoes.paginaPadrao || PAGINA_PADRAO
  const limite = Math.min(limiteInformado || opcoes.limitePadrao || LIMITE_PADRAO, limiteMaximo)
  return { solicitada, pagina, limite, offset: (pagina - 1) * limite }
}

function montarPaginacao(total, pagina, limite) {
  const quantidade = Number(total || 0)
  const totalPaginas = Math.max(1, Math.ceil(quantidade / limite))
  return {
    pagina,
    limite,
    total: quantidade,
    totalPaginas,
    temAnterior: pagina > 1,
    temProxima: pagina < totalPaginas,
  }
}

module.exports = { normalizarPaginacao, montarPaginacao }

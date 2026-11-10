export const descricaoStatusPedido = {
  PENDENTE: 'Aguardando pagamento',
  CONFIRMADO: 'Pagamento confirmado · pronto para retirada',
  FALHOU: 'O pagamento não foi concluído',
  CANCELADO: 'Pedido encerrado',
}

export const categoriasProdutos = [
  { id: 'todos', nome: 'Todos' },
  { id: 'barba', nome: 'Barba' },
  { id: 'cabelo', nome: 'Cabelo' },
  { id: 'acessorios', nome: 'Acessórios' },
]

export const filtrosPedidos = [
  { id: 'todos', nome: 'Todos' },
  { id: 'aguardando', nome: 'Aguardando pagamento', status: ['PENDENTE', 'FALHOU'] },
  { id: 'confirmados', nome: 'Confirmados', status: ['CONFIRMADO'] },
  { id: 'encerrados', nome: 'Encerrados', status: ['CANCELADO'] },
]

export function dinheiro(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function normalizarBusca(texto = '') {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function categoriaDoProduto(produto) {
  const texto = normalizarBusca(`${produto.nome} ${produto.descricao || ''}`)
  if (/pente|escova|navalha|acessorio/.test(texto)) return 'acessorios'
  if (/barba|balm|oleo/.test(texto)) return 'barba'
  return 'cabelo'
}

export function formatarDataPedido(valor) {
  const correspondencia = String(valor || '').match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})$/)
  if (!correspondencia) return valor
  const [, dia, mes, ano, horario] = correspondencia
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia))
  const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `${dataFormatada} às ${horario}`
}

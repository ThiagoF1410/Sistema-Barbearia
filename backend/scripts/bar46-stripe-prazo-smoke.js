require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { getStripe } = require('../src/services/stripeService')
const { criarExpiracaoPagamentosService } = require('../src/services/expiracaoPagamentosService')

const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/stripe-prazo')
const resultados = []
let usuarioId = null
let clienteId = null
let agendamentoId = null
let pagamentoId = null
let pedidoId = null
let sessionId = null

function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}

async function requisitar(caminho, token, opcoes = {}) {
  const resposta = await fetch(`${api}${caminho}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opcoes.headers || {}) },
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(`${caminho} retornou ${resposta.status}: ${corpo.message || ''}`)
  return corpo
}

function proximosMeses(quantidade = 7) {
  const hoje = new Date()
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + indice, 1)
    return { ano: data.getFullYear(), mes: data.getMonth() + 1 }
  })
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const cadastroResposta = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nome: 'Cliente Stripe BAR 46', email: `bar46.stripe.${marcador}@example.com`,
      telefone: '00000000000', password: 'TesteBar46@2026',
    }),
  })
  const cadastro = await cadastroResposta.json()
  if (cadastroResposta.status !== 201 || !cadastro.token) throw new Error(`Cadastro falhou: ${cadastroResposta.status}`)
  usuarioId = cadastro.user.id
  const cliente = await pool.query('SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1', [usuarioId])
  clienteId = cliente.rows[0].idcliente

  const [servicos, profissionais] = await Promise.all([
    requisitar('/servicos', cadastro.token), requisitar('/profissionais', cadastro.token),
  ])
  const servico = servicos.filter((item) => item.tipo === 'servico').sort((a, b) => Number(a.duracao) - Number(b.duracao))[0]
  const produto = servicos.find((item) => item.tipo === 'produto')
  const profissional = profissionais[0]
  if (!servico || !produto || !profissional) throw new Error('Servico, produto e profissional ativos sao necessarios.')

  let escolha = null
  for (const referencia of proximosMeses()) {
    const calendario = await requisitar(`/agenda/calendario?ano=${referencia.ano}&mes=${referencia.mes}&servicoId=${servico.idservico}&profissionalId=${profissional.idprofissional}`, cadastro.token)
    for (const dia of calendario.filter((item) => item.disponivel)) {
      const horarios = await requisitar(`/agenda/horarios-disponiveis?data=${dia.data}&servicoId=${servico.idservico}&profissionalId=${profissional.idprofissional}`, cadastro.token)
      if (horarios.horarios?.length) {
        escolha = { data: dia.data, horario: horarios.horarios[0].inicio }
        break
      }
    }
    if (escolha) break
  }
  if (!escolha) throw new Error('Nenhum horario livre encontrado.')

  const agendamento = await requisitar('/agendamentos', cadastro.token, {
    method: 'POST', body: JSON.stringify({
      servicoId: servico.idservico,
      profissionalId: profissional.idprofissional,
      data: escolha.data,
      horario: escolha.horario,
    }),
  })
  agendamentoId = agendamento.idagendamento

  const inicio = Date.now()
  const checkout = await requisitar('/pagamentos/checkout', cadastro.token, {
    method: 'POST', body: JSON.stringify({
      agendamentoId,
      produtos: [{ produtoId: produto.idservico, quantidade: 2 }],
    }),
  })
  sessionId = checkout.sessionId
  const stripe = getStripe()
  const [sessao, linhas, banco] = await Promise.all([
    stripe.checkout.sessions.retrieve(sessionId),
    stripe.checkout.sessions.listLineItems(sessionId, { limit: 20 }),
    pool.query(
      `SELECT pg.idpagamento, pg.valor, pg.statuspagamento, pg.metodo, pg.checkout_expira_em,
              pe.idpedido, pe.total AS total_produtos,
              pi.quantidade, pi.preco_snapshot
       FROM public.pagamento pg
       LEFT JOIN public.pedido pe ON pe.idpedido = pg.pedido_idpedido
       LEFT JOIN public.pedido_item pi ON pi.pedido_idpedido = pe.idpedido
       WHERE pg.agendamento_idagendamento = $1`,
      [agendamentoId]
    ),
  ])
  const registro = banco.rows[0]
  pagamentoId = registro.idpagamento
  pedidoId = registro.idpedido
  const esperado = Number(servico.preco) + (Number(produto.preco) * 2)
  const totalLinhas = linhas.data.reduce((total, item) => total + Number(item.amount_total || 0), 0) / 100
  registrar('CT-STRIPE-11A', 'Checkout de servico com produto adicional preserva itens e total',
    sessao.metadata?.contexto === 'agendamento_com_produtos'
      && Number(registro.valor) === esperado
      && Number(registro.quantidade) === 2
      && Number(registro.preco_snapshot) === Number(produto.preco)
      && linhas.data.length === 2
      && totalLinhas === esperado,
    JSON.stringify({ esperado, totalLinhas, linhas: linhas.data.map((item) => ({ descricao: item.description, quantidade: item.quantity, total: item.amount_total })), registro }))

  const filas = await pool.query(
    `SELECT tipo, status, proxima_tentativa_em
     FROM public.whatsapp_notificacao
     WHERE agendamento_idagendamento = $1
     ORDER BY tipo`,
    [agendamentoId]
  )
  const expiraMs = new Date(registro.checkout_expira_em).getTime()
  const lembrete = filas.rows.find((item) => item.tipo === 'LEMBRETE_PAGAMENTO')
  const reserva = filas.rows.find((item) => item.tipo === 'RESERVA_PAGAMENTO')
  const prazoSegundos = Math.round((expiraMs - inicio) / 1000)
  const antecedenciaLembrete = lembrete
    ? Math.round((expiraMs - new Date(lembrete.proxima_tentativa_em).getTime()) / 1000)
    : null
  registrar('CT-STRIPE-10A', 'Checkout agenda um unico lembrete tres minutos antes do vencimento',
    Boolean(reserva) && Boolean(lembrete)
      && filas.rows.filter((item) => item.tipo === 'LEMBRETE_PAGAMENTO').length === 1
      && antecedenciaLembrete >= 179 && antecedenciaLembrete <= 181,
    JSON.stringify({ filas: filas.rows, antecedenciaLembrete }))
  registrar('CT-STRIPE-09A', 'Checkout define prazo de dez minutos',
    prazoSegundos >= 595 && prazoSegundos <= 605,
    JSON.stringify({ prazoSegundos, inicio: new Date(inicio).toISOString(), expiraEm: registro.checkout_expira_em }))

  await pool.query(
    `UPDATE public.pagamento SET checkout_expira_em = NOW() - INTERVAL '1 second' WHERE idpagamento = $1`,
    [pagamentoId]
  )
  const expirador = criarExpiracaoPagamentosService({ stripeFactory: () => stripe, logger: { warn() {} } })
  const expiracao = await expirador.expirarPagamento(pagamentoId)
  const aposExpirar = await pool.query(
    `SELECT pg.statuspagamento, a.statusagendamento, pe.status AS statuspedido,
            EXISTS(SELECT 1 FROM public.whatsapp_notificacao wn
                   WHERE wn.agendamento_idagendamento = a.idagendamento
                     AND wn.tipo = 'PAGAMENTO_EXPIRADO') AS notificacao_expirada
     FROM public.pagamento pg
     JOIN public.agendamento a ON a.idagendamento = pg.agendamento_idagendamento
     LEFT JOIN public.pedido pe ON pe.idpedido = pg.pedido_idpedido
     WHERE pg.idpagamento = $1`,
    [pagamentoId]
  )
  const estado = aposExpirar.rows[0]
  registrar('CT-STRIPE-09B', 'Vencimento cancela pagamento, agendamento e pedido adicional',
    (expiracao.expirado || estado?.statuspagamento === 'CANCELADO')
      && estado?.statuspagamento === 'CANCELADO'
      && estado?.statusagendamento === 'CANCELADO'
      && estado?.statuspedido === 'CANCELADO'
      && estado?.notificacao_expirada === true,
    JSON.stringify({ expiracao, estado }))

  const relatorio = {
    executadoEm: new Date().toISOString(),
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resultados,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-stripe-prazo-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (sessionId) {
    const stripe = getStripe()
    await stripe.checkout.sessions.expire(sessionId).catch(() => {})
  }
  if (agendamentoId) await pool.query('DELETE FROM public.whatsapp_notificacao WHERE agendamento_idagendamento = $1', [agendamentoId]).catch(() => {})
  if (pagamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PAGAMENTO' AND referencia_id = $1", [pagamentoId]).catch(() => {})
  if (agendamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'AGENDAMENTO' AND referencia_id = $1", [agendamentoId]).catch(() => {})
  if (pagamentoId) await pool.query('DELETE FROM public.pagamento WHERE idpagamento = $1', [pagamentoId]).catch(() => {})
  if (pedidoId) {
    await pool.query('DELETE FROM public.pedido_item WHERE pedido_idpedido = $1', [pedidoId]).catch(() => {})
    await pool.query('DELETE FROM public.pedido WHERE idpedido = $1', [pedidoId]).catch(() => {})
  }
  if (agendamentoId) await pool.query('DELETE FROM public.agendamento WHERE idagendamento = $1', [agendamentoId]).catch(() => {})
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
  await pool.end().catch(() => {})
})

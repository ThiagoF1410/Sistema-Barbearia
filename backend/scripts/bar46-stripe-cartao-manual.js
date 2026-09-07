require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { getStripe } = require('../src/services/stripeService')

const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9333'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/stripe-cartao')
let socket
let sequencia = 0
const pendentes = new Map()
let usuarioId = null
let pedidoId = null
let pagamentoId = null
let sessionId = null
let finalizado = false

function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function conectar() {
  const alvos = await fetch(`${cdpUrl}/json`).then((resposta) => resposta.json())
  const alvo = alvos.find((item) => item.type === 'page')
  if (!alvo) throw new Error('Nenhuma pagina disponivel no Edge de teste.')
  socket = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', (evento) => {
    const mensagem = JSON.parse(evento.data)
    if (!mensagem.id || !pendentes.has(mensagem.id)) return
    const atual = pendentes.get(mensagem.id)
    pendentes.delete(mensagem.id)
    if (mensagem.error) atual.reject(new Error(mensagem.error.message))
    else atual.resolve(mensagem.result)
  })
  await enviar('Page.enable')
  await enviar('Runtime.enable')
}

function enviar(method, params = {}) {
  const id = ++sequencia
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function avaliar(expression) {
  const resposta = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return resposta.result?.value
}

async function navegar(url, espera = 1000) {
  await enviar('Page.navigate', { url })
  await esperar(espera)
}

async function limpar() {
  if (sessionId) {
    const sessao = await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null)
    if (sessao?.status === 'open') await getStripe().checkout.sessions.expire(sessionId).catch(() => {})
  }
  if (pagamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PAGAMENTO' AND referencia_id = $1", [pagamentoId]).catch(() => {})
  if (pedidoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PEDIDO' AND referencia_id = $1", [pedidoId]).catch(() => {})
  if (pagamentoId) await pool.query('DELETE FROM public.pagamento WHERE idpagamento = $1', [pagamentoId]).catch(() => {})
  if (pedidoId) {
    await pool.query('DELETE FROM public.pedido_item WHERE pedido_idpedido = $1', [pedidoId]).catch(() => {})
    await pool.query('DELETE FROM public.pedido WHERE idpedido = $1', [pedidoId]).catch(() => {})
  }
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const cadastroResposta = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nome: 'Cliente Cartao BAR 46', email: `bar46.cartao.${marcador}@example.com`,
      telefone: '00000000000', password: 'TesteBar46@2026',
    }),
  })
  const cadastro = await cadastroResposta.json()
  if (cadastroResposta.status !== 201) throw new Error(`Cadastro falhou: ${cadastroResposta.status}`)
  usuarioId = cadastro.user.id
  const produtos = await fetch(`${api}/servicos`).then((resposta) => resposta.json())
  const produto = produtos.find((item) => item.tipo === 'produto')
  if (!produto) throw new Error('Nenhum produto ativo para o checkout.')

  const checkoutResposta = await fetch(`${api}/pedidos/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cadastro.token}`, origin: frontend },
    body: JSON.stringify({
      itens: [{ produtoId: produto.idservico, quantidade: 1 }],
      origemRetorno: frontend,
    }),
  })
  const checkout = await checkoutResposta.json()
  if (checkoutResposta.status !== 201) throw new Error(`Checkout falhou: ${checkoutResposta.status} ${checkout.message || ''}`)
  pedidoId = checkout.pedidoId
  sessionId = checkout.sessionId
  pagamentoId = (await pool.query('SELECT idpagamento FROM public.pagamento WHERE pedido_idpedido = $1', [pedidoId])).rows[0].idpagamento

  await conectar()
  await navegar(`${frontend}/login`, 500)
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(cadastro.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify({ ...cadastro.user, nome: cadastro.user.name }))}); true`)
  await navegar(checkout.checkoutUrl, 1200)
  console.log(JSON.stringify({
    estado: 'AGUARDANDO_PAGAMENTO_MANUAL',
    instrucao: 'Use o cartao 4242 4242 4242 4242, data futura e CVC de tres digitos.',
    pedidoId,
    sessionId,
  }))

  const limite = Date.now() + (10 * 60 * 1000)
  let sessao
  while (Date.now() < limite) {
    sessao = await getStripe().checkout.sessions.retrieve(sessionId)
    if (sessao.payment_status === 'paid') break
    await esperar(2000)
  }
  if (sessao?.payment_status !== 'paid') throw new Error('O pagamento manual nao foi concluido dentro do prazo.')

  const consulta = await fetch(`${api}/pagamentos/checkout/${sessionId}`, {
    headers: { authorization: `Bearer ${cadastro.token}` },
  })
  const corpoConsulta = await consulta.json()
  await esperar(2500)
  const pagina = await avaliar(`({ url: location.href, titulo: document.querySelector('h1')?.innerText || '', texto: document.body.innerText })`)
  const banco = (await pool.query(
    `SELECT pg.statuspagamento, pe.status AS statuspedido, pg.stripe_payment_intent_id
     FROM public.pagamento pg JOIN public.pedido pe ON pe.idpedido = pg.pedido_idpedido
     WHERE pg.idpagamento = $1`, [pagamentoId]
  )).rows[0]
  const aprovado = consulta.status === 200
    && corpoConsulta.statuspagamento === 'CONFIRMADO'
    && banco.statuspagamento === 'CONFIRMADO'
    && banco.statuspedido === 'CONFIRMADO'
    && Boolean(banco.stripe_payment_intent_id)
    && /\/checkout\/sucesso/.test(pagina.url)
    && /Pagamento aprovado/i.test(pagina.titulo)
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, 'pagamento-cartao-aprovado.png'), Buffer.from(captura.data, 'base64'))
  const relatorio = {
    executadoEm: new Date().toISOString(),
    total: 1,
    aprovados: aprovado ? 1 : 0,
    reprovados: aprovado ? 0 : 1,
    resultados: [{
      id: 'CT-STRIPE-06C',
      descricao: 'Pagamento real com cartao de teste confirma Stripe, banco e pagina de retorno',
      resultado: aprovado ? 'APROVADO' : 'REPROVADO',
      detalhe: aprovado ? '' : JSON.stringify({ consulta: corpoConsulta, banco, pagina }),
    }],
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-stripe-cartao-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  finalizado = true
  if (!aprovado) process.exitCode = 1
}

main().catch((erro) => {
  console.error(JSON.stringify({ estado: 'FALHA', detalhe: erro.message }))
  process.exitCode = 1
}).finally(async () => {
  await limpar()
  socket?.close()
  await pool.end().catch(() => {})
  if (!finalizado) console.log(JSON.stringify({ estado: 'DADOS_TEMPORARIOS_REMOVIDOS' }))
})

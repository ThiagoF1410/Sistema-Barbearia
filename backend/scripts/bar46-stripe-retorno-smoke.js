require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { getStripe } = require('../src/services/stripeService')

const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/stripe-retorno')
const resultados = []
let socket
let sequencia = 0
const pendentes = new Map()
let usuarioId = null
let agendamentoId = null
let pagamentoId = null
let sessionId = null
let eventoId = null

function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}
function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function conectar() {
  const alvos = await fetch(`${cdpUrl}/json`).then((resposta) => resposta.json())
  const alvo = alvos.find((item) => item.type === 'page')
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
  if (resposta.exceptionDetails) throw new Error(resposta.exceptionDetails.text)
  return resposta.result.value
}
async function navegar(url, espera = 1200) {
  await enviar('Page.navigate', { url })
  await esperar(espera)
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const cadastroResposta = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nome: 'Cliente Retorno BAR 46', email: `bar46.retorno.${marcador}@example.com`,
      telefone: '00000000000', password: 'TesteBar46@2026',
    }),
  })
  const cadastro = await cadastroResposta.json()
  if (cadastroResposta.status !== 201) throw new Error(`Cadastro falhou: ${cadastroResposta.status}`)
  usuarioId = cadastro.user.id

  const dados = await pool.query(
    `SELECT c.idcliente,
            (SELECT idprofissional FROM public.profissional WHERE ativo = TRUE ORDER BY idprofissional LIMIT 1) AS idprofissional,
            (SELECT idservico FROM public.servico WHERE tipo = 'servico' ORDER BY duracao, idservico LIMIT 1) AS idservico`
    + ' FROM public.cliente c WHERE c.usuario_idusuario = $1',
    [usuarioId]
  )
  const fixture = dados.rows[0]
  const servico = await pool.query('SELECT nome, duracao, preco FROM public.servico WHERE idservico = $1', [fixture.idservico])
  const data = await pool.query("SELECT TO_CHAR(CURRENT_DATE + INTERVAL '700 days', 'YYYY-MM-DD') AS data")
  const agenda = await pool.query(
    `INSERT INTO public.agenda (data, disponivel) VALUES ($1::date, TRUE)
     ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data RETURNING idagenda`,
    [data.rows[0].data]
  )
  const agendamento = await pool.query(
    `INSERT INTO public.agendamento
      (agenda_idagenda, cliente_idcliente, profissional_idprofissional, servico_idservico,
       dataagendamento, horario, statusagendamento, servico_nome_snapshot, duracao_snapshot, valor_snapshot)
     VALUES ($1, $2, $3, $4, $5::date, '06:00', 'AGENDADO', $6, $7, $8)
     RETURNING idagendamento`,
    [agenda.rows[0].idagenda, fixture.idcliente, fixture.idprofissional, fixture.idservico,
      data.rows[0].data, servico.rows[0].nome, servico.rows[0].duracao, servico.rows[0].preco]
  )
  agendamentoId = agendamento.rows[0].idagendamento

  const checkoutResposta = await fetch(`${api}/pagamentos/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cadastro.token}`, origin: frontend },
    body: JSON.stringify({ agendamentoId, produtos: [], origemRetorno: frontend }),
  })
  const checkout = await checkoutResposta.json()
  if (checkoutResposta.status !== 201) throw new Error(`Checkout falhou: ${checkoutResposta.status} ${checkout.message || ''}`)
  sessionId = checkout.sessionId
  const stripe = getStripe()
  const sessao = await stripe.checkout.sessions.retrieve(sessionId)
  const pagamento = await pool.query('SELECT idpagamento FROM public.pagamento WHERE stripe_checkout_session_id = $1', [sessionId])
  pagamentoId = pagamento.rows[0].idpagamento
  registrar('CT-STRIPE-08A', 'Checkout usa rota local valida de sucesso e cancelamento',
    sessao.success_url === `${frontend}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`
      && sessao.cancel_url === `${frontend}/checkout/cancelado?agendamento=${agendamentoId}`,
    JSON.stringify({ successUrl: sessao.success_url, cancelUrl: sessao.cancel_url }))

  await conectar()
  await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navegar(`${frontend}/login`, 500)
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(cadastro.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify({ ...cadastro.user, nome: cadastro.user.name }))}); true`)
  await navegar(`${frontend}/checkout/sucesso?session_id=${sessionId}`, 900)
  const antes = await avaliar(`({ caminho: location.pathname, texto: document.body.innerText, consultas: document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') })`)

  eventoId = `evt_bar46_${marcador}`
  const objetoSessao = { ...sessao, payment_status: 'paid', payment_intent: `pi_bar46_${marcador}` }
  const payload = JSON.stringify({
    id: eventoId,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'checkout.session.completed',
    data: { object: objetoSessao },
  })
  const assinatura = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET })
  const webhook = await fetch(`${api}/pagamentos/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': assinatura },
    body: payload,
  })
  const corpoWebhook = await webhook.json().catch(() => ({}))
  const banco = await pool.query('SELECT statuspagamento, stripe_payment_intent_id FROM public.pagamento WHERE idpagamento = $1', [pagamentoId])
  registrar('CT-STRIPE-06A', 'Webhook assinado confirma o pagamento e registra o PaymentIntent',
    webhook.status === 200
      && corpoWebhook.recebido === true
      && banco.rows[0]?.statuspagamento === 'CONFIRMADO'
      && banco.rows[0]?.stripe_payment_intent_id === objetoSessao.payment_intent,
    JSON.stringify({ statusWebhook: webhook.status, corpoWebhook, banco: banco.rows[0] }))

  await esperar(3500)
  const depois = await avaliar(`({ caminho: location.pathname, titulo: document.querySelector('h1')?.innerText || '', texto: document.body.innerText, alerta: document.querySelector('[role="alert"]')?.innerText || '' })`)
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, 'pagamento-aprovado-mobile.png'), Buffer.from(captura.data, 'base64'))
  registrar('CT-STRIPE-07A', 'Tela aberta atualiza o status automaticamente sem recarregar',
    /Verificando pagamento/i.test(antes.texto)
      && /Pagamento aprovado/i.test(depois.titulo)
      && depois.caminho === '/checkout/sucesso',
    JSON.stringify({ antes, depois }))
  registrar('CT-STRIPE-08B', 'Pagina de retorno exibe aprovacao e navegacao funcional',
    /Pagamento aprovado/i.test(depois.titulo)
      && !depois.alerta
      && /Ver historico/i.test(String(depois.texto).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      && /Voltar ao painel/i.test(depois.texto),
    JSON.stringify(depois))

  const repetido = await fetch(`${api}/pagamentos/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': assinatura }, body: payload,
  })
  const corpoRepetido = await repetido.json().catch(() => ({}))
  registrar('CT-STRIPE-06B', 'Webhook repetido e idempotente',
    repetido.status === 200 && corpoRepetido.duplicado === true,
    JSON.stringify({ status: repetido.status, corpo: corpoRepetido }))

  const relatorio = {
    executadoEm: new Date().toISOString(),
    observacao: 'O evento assinado usa a sessao Stripe real, com payment_status de teste controlado. O preenchimento do cartao hospedado ainda requer validacao manual.',
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resultados,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-stripe-retorno-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (sessionId) await getStripe().checkout.sessions.expire(sessionId).catch(() => {})
  if (agendamentoId) await pool.query('DELETE FROM public.whatsapp_notificacao WHERE agendamento_idagendamento = $1', [agendamentoId]).catch(() => {})
  if (eventoId) await pool.query('DELETE FROM public.stripe_evento WHERE stripe_evento_id = $1', [eventoId]).catch(() => {})
  if (pagamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PAGAMENTO' AND referencia_id = $1", [pagamentoId]).catch(() => {})
  if (agendamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'AGENDAMENTO' AND referencia_id = $1", [agendamentoId]).catch(() => {})
  if (pagamentoId) await pool.query('DELETE FROM public.pagamento WHERE idpagamento = $1', [pagamentoId]).catch(() => {})
  if (agendamentoId) await pool.query('DELETE FROM public.agendamento WHERE idagendamento = $1', [agendamentoId]).catch(() => {})
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
  socket?.close()
  await pool.end().catch(() => {})
})

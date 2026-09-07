require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { getStripe } = require('../src/services/stripeService')

const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/checkout-nova-aba')
let socket
let sequencia = 0
const pendentes = new Map()
let usuarioId = null
let pedidoId = null
let pagamentoId = null
let sessionId = null
let checkoutTargetId = null

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
  return resposta.result?.value
}
async function navegar(url, espera = 1300) {
  await enviar('Page.navigate', { url })
  await esperar(espera)
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const cadastroResposta = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome: 'Cliente Aba BAR 46', email: `bar46.aba.${marcador}@example.com`, telefone: '00000000000', password: 'TesteBar46@2026' }),
  })
  const cadastro = await cadastroResposta.json()
  if (cadastroResposta.status !== 201) throw new Error(`Cadastro falhou: ${cadastroResposta.status}`)
  usuarioId = cadastro.user.id
  const produtos = await fetch(`${api}/servicos`).then((resposta) => resposta.json())
  const produto = produtos.find((item) => item.tipo === 'produto')
  if (!produto) throw new Error('Nenhum produto ativo.')

  await conectar()
  await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navegar(`${frontend}/login`, 500)
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(cadastro.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify({ ...cadastro.user, nome: cadastro.user.name }))}); localStorage.setItem('rei-da-navalha:carrinho', JSON.stringify({ ${JSON.stringify(String(produto.idservico))}: 1 })); true`)
  await navegar(`${frontend}/sacola`, 1600)
  const alvosAntes = await fetch(`${cdpUrl}/json`).then((resposta) => resposta.json())
  const clicou = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('button')).find((item) => /Pagar on-line/i.test(item.innerText))
    if (!botao) return false
    botao.click()
    return true
  })()`)
  await esperar(3500)
  const alvosDepois = await fetch(`${cdpUrl}/json`).then((resposta) => resposta.json())
  const checkoutTarget = alvosDepois.find((item) => item.type === 'page' && /^https:\/\/checkout\.stripe\.com\//.test(item.url))
  checkoutTargetId = checkoutTarget?.id || null
  const original = await avaliar(`(() => {
    const dialogo = document.querySelector('[role="dialog"]')
    return {
      url: location.href,
      dialogo: Boolean(dialogo),
      texto: dialogo?.innerText || '',
      contador: Boolean(dialogo?.querySelector('[role="timer"], [aria-label*="Tempo"], [aria-live="polite"]'))
        || /\\d{2}:\\d{2}/.test(dialogo?.innerText || '')
    }
  })()`)
  const pagamento = await pool.query(
    `SELECT pg.idpagamento, pg.stripe_checkout_session_id, pe.idpedido
     FROM public.pagamento pg JOIN public.pedido pe ON pe.idpedido = pg.pedido_idpedido
     JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
     WHERE c.usuario_idusuario = $1 ORDER BY pg.idpagamento DESC LIMIT 1`, [usuarioId]
  )
  pagamentoId = pagamento.rows[0]?.idpagamento
  pedidoId = pagamento.rows[0]?.idpedido
  sessionId = pagamento.rows[0]?.stripe_checkout_session_id
  const testes = [
    {
      id: 'CT-STRIPE-07B',
      descricao: 'Checkout abre em nova aba sem substituir a loja',
      aprovado: clicou && Boolean(checkoutTarget) && original.url === `${frontend}/sacola` && alvosDepois.length > alvosAntes.length,
      detalhe: { clicou, checkoutUrl: checkoutTarget?.url, original, alvosAntes: alvosAntes.length, alvosDepois: alvosDepois.length },
    },
    {
      id: 'CT-STRIPE-07C',
      descricao: 'Aba original permanece com status aguardando pagamento e contador',
      aprovado: original.dialogo && /Aguardando pagamento/i.test(original.texto) && original.contador,
      detalhe: original,
    },
  ]
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, 'aba-original-aguardando-mobile.png'), Buffer.from(captura.data, 'base64'))
  const relatorio = {
    executadoEm: new Date().toISOString(),
    total: testes.length,
    aprovados: testes.filter((item) => item.aprovado).length,
    reprovados: testes.filter((item) => !item.aprovado).length,
    resultados: testes.map((item) => ({ id: item.id, descricao: item.descricao, resultado: item.aprovado ? 'APROVADO' : 'REPROVADO', detalhe: item.aprovado ? '' : JSON.stringify(item.detalhe) })),
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-checkout-nova-aba-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (checkoutTargetId) await enviar('Target.closeTarget', { targetId: checkoutTargetId }).catch(() => {})
  if (sessionId) await getStripe().checkout.sessions.expire(sessionId).catch(() => {})
  if (pagamentoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PAGAMENTO' AND referencia_id = $1", [pagamentoId]).catch(() => {})
  if (pedidoId) await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'PEDIDO' AND referencia_id = $1", [pedidoId]).catch(() => {})
  if (pagamentoId) await pool.query('DELETE FROM public.pagamento WHERE idpagamento = $1', [pagamentoId]).catch(() => {})
  if (pedidoId) {
    await pool.query('DELETE FROM public.pedido_item WHERE pedido_idpedido = $1', [pedidoId]).catch(() => {})
    await pool.query('DELETE FROM public.pedido WHERE idpedido = $1', [pedidoId]).catch(() => {})
  }
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
  socket?.close()
  await pool.end().catch(() => {})
})

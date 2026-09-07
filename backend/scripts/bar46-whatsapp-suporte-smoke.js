require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')
const { criarAtendimentoWhatsappService } = require('../src/services/atendimentoWhatsappService')

const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/whatsapp-suporte')
const resultados = []
let socket
let sequencia = 0
const pendentes = new Map()
let chaveNotificacao = null

function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}

function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function conectar() {
  const alvos = await fetch(`${cdpUrl}/json`).then((resposta) => resposta.json())
  const alvo = alvos.find((item) => item.type === 'page')
  if (!alvo) throw new Error('Nenhuma pagina disponivel no Edge via CDP.')
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

async function navegar(rota, espera = 1600) {
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await esperar(espera)
}

async function capturar(nome) {
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, nome), Buffer.from(captura.data, 'base64'))
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  await pool.query("DELETE FROM public.notificacao WHERE chave_evento LIKE 'ATENDIMENTO_WHATSAPP:BAR46-%'")
  const clienteResult = await pool.query(
    `SELECT u.idusuario, u.nome, u.email, u.token_version, c.idcliente, c.telefone
     FROM public.usuario u
     JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
     WHERE c.telefone IS NOT NULL AND BTRIM(c.telefone) <> ''
     ORDER BY u.idusuario LIMIT 1`
  )
  const cliente = clienteResult.rows[0]
  if (!cliente) throw new Error('Nenhum cliente com telefone para o teste.')

  await conectar()
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  })
  await navegar('/login', 600)
  const usuarioLocal = {
    id: cliente.idusuario,
    idusuario: cliente.idusuario,
    nome: cliente.nome,
    name: cliente.nome,
    email: cliente.email,
    role: 'cliente',
  }
  const jwt = signToken({
    id: cliente.idusuario,
    email: cliente.email,
    role: 'cliente',
    tokenVersion: cliente.token_version,
  })
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(jwt)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(usuarioLocal))}); true`)
  await navegar('/dashboard')

  const abriu = await avaliar(`(() => {
    const botao = document.querySelector('button[aria-label="Abrir atendimento pelo WhatsApp"]')
    if (!botao) return false
    botao.click()
    return true
  })()`)
  await esperar(1000)
  await capturar('suporte-mobile-aberto.png')

  const painel = await avaliar(`(() => ({
    dialogo: Boolean(document.querySelector('[role="dialog"]')),
    assuntos: Array.from(document.querySelectorAll('[role="dialog"] button')).map((botao) => botao.innerText.trim()).filter(Boolean),
    erro: document.querySelector('[role="alert"]')?.innerText || '',
    texto: document.querySelector('[role="dialog"]')?.innerText || ''
  }))()`)
  const esperados = [
    'Solicitar reembolso', 'Alterar data ou horario', 'Cancelar agendamento',
    'Duvidas sobre pagamento', 'Duvidas sobre pedido', 'Outro assunto',
  ]
  const normalizar = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const assuntosTexto = normalizar(painel.assuntos.join('\n'))
  registrar(
    'CT-WPP-05A',
    'Suporte flutuante exibe os seis assuntos no mobile',
    abriu && painel.dialogo && !painel.erro && esperados.every((item) => assuntosTexto.includes(normalizar(item))),
    JSON.stringify(painel)
  )

  const abertura = await avaliar(`(() => {
    window.__bar46WhatsappUrl = ''
    window.open = (url) => { window.__bar46WhatsappUrl = String(url); return {} }
    const botao = Array.from(document.querySelectorAll('[role="dialog"] button'))
      .find((item) => item.innerText.includes('Solicitar reembolso'))
    if (!botao) return false
    botao.click()
    return true
  })()`)
  await esperar(200)
  const urlWhatsapp = await avaliar('window.__bar46WhatsappUrl')
  let mensagem = ''
  try {
    const url = new URL(urlWhatsapp)
    mensagem = url.searchParams.get('text') || ''
  } catch {}
  const mensagemValida = /wa\.me\/\d+/.test(urlWhatsapp)
    && mensagem.includes('ORN-REEMBOLSO')
    && mensagem.includes(cliente.nome.split(/\s+/)[0])
    && /Numero do pedido ou agendamento:/i.test(normalizar(mensagem))
    && !mensagem.includes('\uFFFD')
  registrar(
    'CT-WPP-05B',
    'Assunto abre WhatsApp com protocolo, identificacao e campos orientados',
    abertura && mensagemValida,
    JSON.stringify({ urlWhatsapp, mensagem })
  )

  const messageId = `BAR46-${Date.now()}`
  chaveNotificacao = `ATENDIMENTO_WHATSAPP:${messageId}`
  const servico = criarAtendimentoWhatsappService({ logger: { info() {}, warn() {} } })
  const processamento = await servico.processarMensagem({
    messageId,
    telefone: cliente.telefone,
    texto: 'Protocolo: ORN-REEMBOLSO',
  })
  const notificacoes = await pool.query(
    `SELECT n.tipo, n.titulo, n.mensagem, n.link, n.referencia_tipo, n.referencia_id
     FROM public.notificacao n
     WHERE n.chave_evento = $1
     ORDER BY n.idnotificacao`,
    [chaveNotificacao]
  )
  const admins = await pool.query(
    `SELECT COUNT(*)::integer AS total FROM public.administrador`
  )
  const notificacoesValidas = processamento.processada
    && notificacoes.rows.length === admins.rows[0].total
    && notificacoes.rows.every((item) => item.tipo === 'ATENDIMENTO_WHATSAPP'
      && item.link === '/admin/pagamentos'
      && item.referencia_tipo === 'CLIENTE'
      && Number(item.referencia_id) === Number(cliente.idcliente))
  registrar(
    'CT-WPP-06A',
    'Mensagem recebida pelo Baileys gera uma notificacao para cada administrador ativo',
    notificacoesValidas,
    JSON.stringify({ processamento, admins: admins.rows[0].total, notificacoes: notificacoes.rows })
  )

  const relatorio = {
    executadoEm: new Date().toISOString(),
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resultados,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-whatsapp-suporte-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (chaveNotificacao) {
    await pool.query('DELETE FROM public.notificacao WHERE chave_evento = $1', [chaveNotificacao]).catch(() => {})
  }
  socket?.close()
  await pool.end().catch(() => {})
})

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const api = process.env.BAR46_API_URL || 'http://127.0.0.1:3001/api'
const frontend = process.env.BAR46_FRONTEND_URL || 'http://127.0.0.1:5181'
const cdp = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9224'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/correcoes-bugs')
const resultados = []
const pendentes = new Map()
let socket
let sequencia = 0

function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}

function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

function enviar(method, params = {}) {
  const id = ++sequencia
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function conectar() {
  const alvos = await fetch(`${cdp}/json`).then((resposta) => resposta.json())
  const alvo = alvos.find((item) => item.type === 'page')
  if (!alvo) throw new Error('Página do Edge não encontrada.')
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

async function avaliar(expression) {
  const resposta = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return resposta.result.value
}

async function navegar(rota, espera = 1800) {
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await esperar(espera)
}

async function captura(nome) {
  const imagem = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, nome), Buffer.from(imagem.data, 'base64'))
}

async function testarRateLimit() {
  const codigos = []
  for (let tentativa = 0; tentativa < 11; tentativa += 1) {
    const resposta = await fetch(`${api}/clientes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    codigos.push(resposta.status)
  }
  const primeiroBloqueio = codigos.indexOf(429)
  const bloqueioPersistente = primeiroBloqueio >= 0
    && primeiroBloqueio <= 10
    && codigos.slice(primeiroBloqueio).every((codigo) => codigo === 429)
    && codigos.slice(0, primeiroBloqueio).every((codigo) => codigo === 400)
  registrar('BUG-001', 'Rota alternativa de cadastro aplica o mesmo limite de dez tentativas',
    bloqueioPersistente,
    JSON.stringify(codigos))
}

function testarEntregaEDocumentacao() {
  const envExample = path.resolve(__dirname, '../.env.example')
  const conteudoEnv = fs.existsSync(envExample) ? fs.readFileSync(envExample, 'utf8') : ''
  const obrigatorias = ['DATABASE_URL=', 'JWT_SECRET=', 'STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=', 'EMAIL_USER=', 'WHATSAPP_ENABLED=', 'WHATSAPP_TEST_RECIPIENT=']
  registrar('BUG-002', '.env.example existe sem valores secretos e documenta as integrações',
    Boolean(conteudoEnv) && obrigatorias.every((nome) => conteudoEnv.includes(nome)) && !/sk_(?:test|live)_[A-Za-z0-9]{8,}/.test(conteudoEnv),
    'Arquivo ausente, incompleto ou com possível segredo.')

  const readme = fs.readFileSync(path.resolve(__dirname, '../../README.md'), 'utf8')
  const migrations = Array.from({ length: 8 }, (_, indice) => String(indice + 19).padStart(3, '0'))
  registrar('BUG-003', 'README documenta as migrations 019 a 026',
    migrations.every((numero) => readme.includes(`\`${numero}_`)),
    'Nem todas as migrations 019–026 foram localizadas no README.')
}

async function testarInterface() {
  const usuarioResultado = await pool.query(
    `SELECT u.idusuario, u.nome, u.email, u.token_version
       FROM public.usuario u
       JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
      ORDER BY u.idusuario LIMIT 1`,
  )
  const usuario = usuarioResultado.rows[0]
  if (!usuario) throw new Error('Cliente necessário para o reteste não foi encontrado.')
  const dadosFrontend = { idusuario: usuario.idusuario, nome: usuario.nome, email: usuario.email, role: 'cliente' }
  const jwt = signToken({ id: usuario.idusuario, email: usuario.email, role: 'cliente', tokenVersion: usuario.token_version })

  await conectar()
  await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navegar('/login', 700)
  await avaliar(`localStorage.setItem('token', 'jwt.invalido.bar46'); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(dadosFrontend))}); true`)
  await navegar('/dashboard', 2600)
  const sessao = await avaliar(`({ rota: location.pathname, token: localStorage.getItem('token'), alerta: document.querySelector('[role="alert"]')?.innerText || '' })`)
  registrar('BUG-005', 'JWT inválido encerra a sessão e apresenta aviso formal',
    sessao.rota === '/login' && !sessao.token && /sessão expirou/i.test(sessao.alerta),
    JSON.stringify(sessao))
  await captura('bug-005-sessao-expirada-390.png')

  await navegar('/login', 900)
  const avisoRepetido = await avaliar(`document.querySelector('[role="alert"]')?.innerText || ''`)
  registrar('BUG-005B', 'Aviso de sessão expirada é exibido uma única vez', !avisoRepetido, avisoRepetido)

  await avaliar(`localStorage.setItem('token', ${JSON.stringify(jwt)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(dadosFrontend))}); true`)
  await navegar('/agendar', 3000)
  const foco = await avaliar(`(() => {
    const titulo = document.querySelector('h2[tabindex="-1"]')
    titulo?.focus()
    const estiloTitulo = titulo ? getComputedStyle(titulo) : null
    const controle = document.querySelector('a[href="/dashboard"]')
    controle?.focus()
    const estiloControle = controle ? getComputedStyle(controle) : null
    return {
      tituloExiste: Boolean(titulo),
      outlineTitulo: estiloTitulo?.outlineStyle || '',
      larguraOutlineTitulo: estiloTitulo?.outlineWidth || '',
      controleExiste: Boolean(controle),
      outlineControle: estiloControle?.outlineStyle || '',
      larguraOutlineControle: estiloControle?.outlineWidth || '',
    }
  })()`)
  const tituloSemMoldura = foco.tituloExiste && (foco.outlineTitulo === 'none' || foco.larguraOutlineTitulo === '0px')
  const controleComFoco = foco.controleExiste && foco.outlineControle !== 'none' && foco.larguraOutlineControle !== '0px'
  registrar('BUG-004', 'Título programaticamente focado não exibe moldura e controle interativo mantém foco visível',
    tituloSemMoldura && controleComFoco, JSON.stringify(foco))
  await captura('bug-004-foco-agendamento-390.png')
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  await testarRateLimit()
  testarEntregaEDocumentacao()
  await testarInterface()
  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
  }
  const relatorio = { executadoEm: new Date().toISOString(), resumo, resultados }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-bugs-reteste-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ resumo, reprovados: resultados.filter((item) => item.resultado === 'REPROVADO') }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(JSON.stringify({ erro: 'Falha no reteste das correções.', detalhe: erro.message }))
  process.exitCode = 1
}).finally(async () => {
  socket?.close()
  await pool.end().catch(() => {})
})

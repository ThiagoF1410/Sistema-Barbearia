require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const cdpPort = Number(process.env.BAR46_CDP_PORT || 9222)
const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const evidencePrefix = process.env.BAR46_EVIDENCE_PREFIX || ''
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias')
const resultados = []
let sequencia = 0
let socket
const pendentes = new Map()

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function obterUsuario(role) {
  const relacao = role === 'admin'
    ? 'administrador'
    : role === 'profissional' ? 'profissional' : 'cliente'
  const ativo = role === 'profissional' ? 'WHERE perfil.ativo = TRUE' : ''
  const ordem = role === 'cliente' ? 'DESC' : 'ASC'
  const resultado = await pool.query(
    `SELECT u.idusuario, u.nome, u.email, u.token_version
     FROM public.usuario u
     JOIN public.${relacao} perfil ON perfil.usuario_idusuario = u.idusuario
     ${ativo}
     ORDER BY u.idusuario ${ordem} LIMIT 1`
  )
  const usuario = resultado.rows[0]
  if (!usuario) throw new Error(`Não existe usuário para o perfil ${role}.`)
  return {
    usuario,
    token: signToken({
      id: usuario.idusuario,
      email: usuario.email,
      role,
      tokenVersion: usuario.token_version,
    }),
  }
}

async function conectarCdp() {
  const destino = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(frontend)}`, { method: 'PUT' })
  if (!destino.ok) throw new Error(`Edge DevTools respondeu ${destino.status}.`)
  const pagina = await destino.json()
  socket = new WebSocket(pagina.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new Error('Não foi possível conectar ao Edge DevTools.')), { once: true })
  })
  socket.addEventListener('message', (evento) => {
    const mensagem = JSON.parse(evento.data)
    if (!mensagem.id || !pendentes.has(mensagem.id)) return
    const { resolve, reject } = pendentes.get(mensagem.id)
    pendentes.delete(mensagem.id)
    if (mensagem.error) reject(new Error(mensagem.error.message))
    else resolve(mensagem.result)
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

async function prepararPerfil(role, dados) {
  await enviar('Page.navigate', { url: `${frontend}/login` })
  await esperar(1500)
  const usuarioFrontend = {
    id: dados.usuario.idusuario,
    idusuario: dados.usuario.idusuario,
    nome: dados.usuario.nome,
    name: dados.usuario.nome,
    email: dados.usuario.email,
    role,
  }
  await enviar('Runtime.evaluate', {
    expression: `localStorage.setItem('token', ${JSON.stringify(dados.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(usuarioFrontend))});`,
  })
}

async function capturar(role, rota, nome, largura, altura = 1000) {
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: largura,
    height: altura,
    deviceScaleFactor: 1,
    mobile: largura < 600,
  })
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await esperar(3500)
  const diagnostico = await enviar('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => ({
      titulo: document.title,
      url: location.pathname,
      largura: innerWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      carregando: document.body.innerText.includes('Carregando...'),
      erroTecnico: /Request failed|status code|ECONN|TypeError|undefined/i.test(document.body.innerText),
      texto: document.body.innerText.slice(0, 180)
    }))()`,
  })
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const arquivo = `${evidencePrefix}${nome}-${largura}.png`
  fs.writeFileSync(path.join(evidenceDir, arquivo), Buffer.from(captura.data, 'base64'))
  const dados = diagnostico.result.value
  const aprovado = dados.url === rota
    && !dados.carregando
    && !dados.erroTecnico
    && dados.scrollWidth <= dados.largura
  resultados.push({
    id: `CT-UI-${String(resultados.length + 1).padStart(2, '0')}`,
    perfil: role,
    rota,
    largura,
    arquivo,
    resultado: aprovado ? 'APROVADO' : 'REPROVADO',
    detalhe: aprovado ? '' : {
      rotaObtida: dados.url,
      carregando: dados.carregando,
      erroTecnico: dados.erroTecnico,
      overflowHorizontal: dados.scrollWidth > dados.largura,
      trecho: dados.texto,
    },
  })
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const perfis = {
    cliente: await obterUsuario('cliente'),
    admin: await obterUsuario('admin'),
    profissional: await obterUsuario('profissional'),
  }
  await conectarCdp()

  const rotas = {
    cliente: ['/dashboard', '/agendar', '/historico', '/perfil', '/loja', '/sacola'],
    admin: ['/admin', '/admin/agendamentos', '/admin/agenda', '/admin/servicos', '/admin/pagamentos', '/admin/relatorios', '/admin/profissionais', '/admin/clientes'],
    profissional: ['/profissional'],
  }
  for (const [role, lista] of Object.entries(rotas)) {
    await prepararPerfil(role, perfis[role])
    for (const rota of lista) {
      const nome = `${role}-${rota.replace(/^\/+|\//g, '-') || 'inicio'}`
      await capturar(role, rota, nome, 1365, 900)
    }
  }

  await prepararPerfil('cliente', perfis.cliente)
  for (const rota of ['/dashboard', '/agendar', '/historico', '/perfil', '/loja', '/sacola']) {
    await capturar('cliente', rota, `cliente-mobile-${rota.replace(/^\/+|\//g, '-')}`, 390, 844)
  }
  await prepararPerfil('admin', perfis.admin)
  for (const rota of ['/admin', '/admin/agendamentos', '/admin/agenda']) {
    await capturar('admin', rota, `admin-mobile-${rota.replace(/^\/+|\//g, '-')}`, 390, 844)
  }
  await prepararPerfil('profissional', perfis.profissional)
  await capturar('profissional', '/profissional', 'profissional-mobile', 390, 844)

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
  }
  const relatorio = { geradoEm: new Date().toISOString(), resumo, resultados }
  fs.writeFileSync(
    path.join(evidenceDir, `${evidencePrefix}bar46-ui-resultados.json`),
    `${JSON.stringify(relatorio, null, 2)}\n`,
    'utf8',
  )
  console.log(JSON.stringify({
    resumo,
    relatorio: `documentos/testes/evidencias/${evidencePrefix}bar46-ui-resultados.json`,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO'),
  }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha na captura autenticada.', detalhe: erro.message || erro.code }))
    process.exitCode = 1
  })
  .finally(async () => {
    socket?.close()
    await pool.end()
  })

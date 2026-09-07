require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const cdpPort = Number(process.env.BAR47_CDP_PORT || 9222)
const frontend = process.env.BAR47_FRONTEND_URL || 'http://localhost:5173'
const evidenceDir = process.env.BAR47_EVIDENCE_DIR
  ? path.resolve(process.env.BAR47_EVIDENCE_DIR)
  : path.resolve(__dirname, '../../documentos/testes/evidencias/bar47')
const ticketPrefix = process.env.BAR47_RESULT_PREFIX || 'BAR47'
const browserLabel = process.env.BAR47_BROWSER_LABEL || 'Edge'
const resultFile = process.env.BAR47_RESULT_FILE || 'bar47-resultados.json'
const resultados = []
const pendentes = new Map()
let sequencia = 0
let socket

const resolucoes = [
  { nome: 'mobile', largura: 360, altura: 800 },
  { nome: 'tablet', largura: 768, altura: 1024 },
  { nome: 'notebook', largura: 1366, altura: 768 },
  { nome: 'desktop', largura: 1920, altura: 1080 },
]

const rotas = {
  publico: ['/inicio', '/login', '/cadastro', '/esqueci-senha', '/resetar-senha', '/termos', '/privacidade'],
  cliente: ['/dashboard', '/servicos', '/loja', '/sacola', '/agendar', '/historico', '/perfil', '/checkout/sucesso', '/checkout/cancelado'],
  profissional: ['/profissional'],
  admin: ['/admin', '/admin/servicos', '/admin/agenda', '/admin/agendamentos', '/admin/pagamentos', '/admin/profissionais', '/admin/clientes', '/admin/relatorios'],
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function enviar(method, params = {}) {
  const id = ++sequencia
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function conectarCdp() {
  const resposta = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(frontend)}`, { method: 'PUT' })
  if (!resposta.ok) throw new Error(`${browserLabel} DevTools respondeu ${resposta.status}.`)
  const pagina = await resposta.json()
  socket = new WebSocket(pagina.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', () => reject(new Error(`Não foi possível conectar ao ${browserLabel} DevTools.`)), { once: true })
  })
  socket.addEventListener('message', (evento) => {
    const mensagem = JSON.parse(evento.data)
    if (!mensagem.id || !pendentes.has(mensagem.id)) return
    const promessa = pendentes.get(mensagem.id)
    pendentes.delete(mensagem.id)
    if (mensagem.error) promessa.reject(new Error(mensagem.error.message))
    else promessa.resolve(mensagem.result)
  })
  await enviar('Page.enable')
  await enviar('Runtime.enable')
}

async function obterUsuario(role) {
  const perfil = role === 'admin' ? 'administrador' : role
  const ativo = role === 'profissional' ? 'WHERE perfil.ativo = TRUE' : ''
  const resultado = await pool.query(
    `SELECT u.idusuario, u.nome, u.email, u.token_version
       FROM public.usuario u
       JOIN public.${perfil} perfil ON perfil.usuario_idusuario = u.idusuario
       ${ativo}
      ORDER BY u.idusuario ASC LIMIT 1`,
  )
  if (!resultado.rows[0]) throw new Error(`Não existe usuário para o perfil ${role}.`)
  const usuario = resultado.rows[0]
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

async function prepararPerfil(role, dados) {
  await enviar('Page.navigate', { url: `${frontend}/inicio` })
  await esperar(500)
  if (role === 'publico') {
    await enviar('Runtime.evaluate', { expression: "localStorage.removeItem('token'); localStorage.removeItem('user');" })
    return
  }
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

async function aguardarPagina(rotaEsperada) {
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    await esperar(250)
    const estado = await enviar('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => { const texto = document.body?.innerText?.trim() || ''; const status = [...document.querySelectorAll('[role="status"]')].some((el) => /carregando/i.test(el.getAttribute('aria-label') || el.innerText || '')); return { rota: location.pathname, pronto: document.readyState === 'complete', conteudo: texto.length > 20, carregando: /Carregando\.\.\./i.test(texto) || status } })()`,
    })
    const valor = estado.result.value
    if (valor.rota === rotaEsperada && valor.pronto && valor.conteudo && !valor.carregando) return true
  }
  return false
}

async function diagnosticar() {
  const resposta = await enviar('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const html = document.documentElement
      const body = document.body
      const visivel = (elemento) => {
        const estilo = getComputedStyle(elemento)
        const caixa = elemento.getBoundingClientRect()
        return estilo.display !== 'none' && estilo.visibility !== 'hidden' && Number(estilo.opacity) > 0 && caixa.width > 0 && caixa.height > 0
      }
      const seletor = 'a,button,input,select,textarea,[role="button"],[role="tab"]'
      const emRegiaoRolavel = (elemento) => {
        let atual = elemento.parentElement
        while (atual && atual !== body) {
          const estilo = getComputedStyle(atual)
          if ((estilo.overflowX === 'auto' || estilo.overflowX === 'scroll') && atual.scrollWidth > atual.clientWidth) return true
          atual = atual.parentElement
        }
        return false
      }
      const foraDaTela = [...document.querySelectorAll(seletor)].filter(visivel).map((elemento) => {
        const caixa = elemento.getBoundingClientRect()
        return { tag: elemento.tagName, texto: (elemento.getAttribute('aria-label') || elemento.innerText || elemento.value || '').trim().slice(0, 55), esquerda: Math.round(caixa.left), direita: Math.round(caixa.right), largura: Math.round(caixa.width), emRegiaoRolavel: emRegiaoRolavel(elemento) }
      }).filter((item) => !item.emRegiaoRolavel && item.direita > 1 && item.esquerda < innerWidth - 1 && (item.esquerda < -1 || item.direita > innerWidth + 1))
      const alvosPequenos = [...document.querySelectorAll('button,a,[role="button"],[role="tab"]')].filter(visivel).map((elemento) => {
        const caixa = elemento.getBoundingClientRect()
        return { texto: (elemento.getAttribute('aria-label') || elemento.innerText || '').trim().slice(0, 55), largura: Math.round(caixa.width), altura: Math.round(caixa.height) }
      }).filter((item) => item.largura < 32 || item.altura < 32)
      const texto = body?.innerText || ''
      const statusCarregando = [...document.querySelectorAll('[role="status"]')].some((elemento) => visivel(elemento) && /carregando/i.test(elemento.getAttribute('aria-label') || elemento.innerText || ''))
      return {
        rota: location.pathname,
        viewport: { largura: innerWidth, altura: innerHeight },
        scrollWidth: Math.max(html.scrollWidth, body?.scrollWidth || 0),
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content || '',
        carregando: /Carregando\.\.\./i.test(texto) || statusCarregando,
        erroTecnico: /Request failed|status code|ECONNREFUSED|TypeError:|undefined is not/i.test(texto),
        foraDaTela,
        alvosPequenos: alvosPequenos.slice(0, 15),
        trecho: texto.trim().slice(0, 180),
      }
    })()`,
  })
  return resposta.result.value
}

async function capturar(role, rota, resolucao) {
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: resolucao.largura,
    height: resolucao.altura,
    deviceScaleFactor: 1,
    mobile: resolucao.largura <= 768,
  })
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await aguardarPagina(rota)
  await esperar(350)
  const diagnostico = await diagnosticar()
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const slug = rota.replace(/^\/+|\//g, '-') || 'inicio'
  const arquivo = `${role}-${slug}-${resolucao.nome}-${resolucao.largura}x${resolucao.altura}.png`
  fs.writeFileSync(path.join(evidenceDir, arquivo), Buffer.from(captura.data, 'base64'))

  const problemas = []
  if (diagnostico.rota !== rota) problemas.push(`rota obtida: ${diagnostico.rota}`)
  if (!/width=device-width/i.test(diagnostico.viewportMeta)) problemas.push('meta viewport ausente ou inválida')
  if (diagnostico.carregando) problemas.push('página permaneceu carregando')
  if (diagnostico.erroTecnico) problemas.push('mensagem técnica exposta')
  if (diagnostico.scrollWidth > diagnostico.viewport.largura + 1) problemas.push(`overflow horizontal de ${diagnostico.scrollWidth - diagnostico.viewport.largura}px`)
  if (diagnostico.foraDaTela.length) problemas.push(`${diagnostico.foraDaTela.length} controle(s) parcialmente fora da tela`)

  resultados.push({
    id: `${ticketPrefix}-${String(resultados.length + 1).padStart(3, '0')}`,
    perfil: role,
    rota,
    resolucao: `${resolucao.largura}x${resolucao.altura}`,
    resultado: problemas.length ? 'REPROVADO' : 'APROVADO',
    problemas,
    controlesForaDaTela: diagnostico.foraDaTela,
    observacaoAlvosMenores32px: diagnostico.alvosPequenos,
    evidencia: arquivo,
  })
}

async function testarMenuMobile(admin) {
  const resolucao = resolucoes[0]
  await prepararPerfil('admin', admin)
  await enviar('Emulation.setDeviceMetricsOverride', { width: resolucao.largura, height: resolucao.altura, deviceScaleFactor: 1, mobile: true })
  await enviar('Page.navigate', { url: `${frontend}/admin/agendamentos` })
  await aguardarPagina('/admin/agendamentos')
  const clique = await enviar('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => { const botao = document.querySelector('[aria-label="Abrir menu administrativo"]'); if (!botao) return false; botao.click(); return true })()`,
  })
  await esperar(450)
  const estado = await enviar('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => { const menu = document.querySelector('[aria-label="Navegação administrativa"]'); const caixa = menu?.getBoundingClientRect(); return { existe: Boolean(menu), aberto: caixa ? caixa.left >= -1 && caixa.right <= innerWidth + 1 : false, largura: caixa ? Math.round(caixa.width) : 0, bodyOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1 } })()`,
  })
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const arquivo = 'admin-menu-aberto-mobile-360x800.png'
  fs.writeFileSync(path.join(evidenceDir, arquivo), Buffer.from(captura.data, 'base64'))
  const valor = estado.result.value
  const aprovado = clique.result.value && valor.existe && valor.aberto && !valor.bodyOverflow
  resultados.push({
    id: `${ticketPrefix}-${String(resultados.length + 1).padStart(3, '0')}`,
    perfil: 'admin',
    rota: '/admin/agendamentos (menu aberto)',
    resolucao: '360x800',
    resultado: aprovado ? 'APROVADO' : 'REPROVADO',
    problemas: aprovado ? [] : ['menu móvel ausente, fora do viewport ou gerando overflow'],
    diagnostico: valor,
    evidencia: arquivo,
  })
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const usuarios = {
    cliente: await obterUsuario('cliente'),
    admin: await obterUsuario('admin'),
    profissional: await obterUsuario('profissional'),
  }
  await conectarCdp()

  for (const [role, lista] of Object.entries(rotas)) {
    await prepararPerfil(role, usuarios[role])
    for (const resolucao of resolucoes) {
      for (const rota of lista) await capturar(role, rota, resolucao)
    }
  }
  await testarMenuMobile(usuarios.admin)

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resolucoes: resolucoes.map((item) => `${item.largura}x${item.altura}`),
  }
  const versaoNavegador = await enviar('Browser.getVersion')
  const relatorio = {
    geradoEm: new Date().toISOString(),
    navegador: browserLabel,
    produto: versaoNavegador.product,
    userAgent: versaoNavegador.userAgent,
    resumo,
    resultados,
  }
  const destino = path.join(evidenceDir, resultFile)
  fs.writeFileSync(destino, `${JSON.stringify(relatorio, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ resumo, reprovados: resultados.filter((item) => item.resultado === 'REPROVADO') }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha na validação responsiva.', detalhe: erro.message || erro.code }))
    process.exitCode = 1
  })
  .finally(async () => {
    socket?.close()
    await pool.end()
  })

require('dotenv').config()

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')

const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/recuperacao-senha')
const resultados = []
let socket
let sequencia = 0
const pendentes = new Map()
let usuarioId = null

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

async function navegar(rota, espera = 1200) {
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await esperar(espera)
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const email = `bar46.senha.${marcador}@example.com`
  const senhaAnterior = 'TesteBar46@2026'
  const senhaNova = 'NovaSenhaBar46@2026'
  const cadastro = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome: 'Cliente Senha BAR 46', email, telefone: '00000000000', password: senhaAnterior }),
  })
  const conta = await cadastro.json()
  if (cadastro.status !== 201 || !conta.user?.id) throw new Error(`Cadastro temporario falhou: ${cadastro.status}`)
  usuarioId = conta.user.id

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  await pool.query(
    `INSERT INTO public.password_reset_tokens (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
    [usuarioId, tokenHash]
  )

  await conectar()
  await enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navegar(`/resetar-senha?token=${encodeURIComponent(token)}`)
  const preencheu = await avaliar(`(() => {
    const definir = (seletor, valor) => {
      const campo = document.querySelector(seletor)
      if (!campo) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    const ok = definir('#password', ${JSON.stringify(senhaNova)}) && definir('#confirm', ${JSON.stringify(senhaNova)})
    document.querySelector('form')?.requestSubmit()
    return ok
  })()`)
  await esperar(1800)
  const retornoUi = await avaliar(`({ texto: document.body.innerText, sucesso: document.body.innerText.includes('Senha redefinida com sucesso') })`)
  registrar('CT-AUTH-09A', 'Link de recuperacao valido redefine a senha pela interface',
    preencheu && retornoUi.sucesso, JSON.stringify(retornoUi))

  const loginAntigo = await fetch(`${api}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: senhaAnterior }),
  })
  const loginNovo = await fetch(`${api}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: senhaNova }),
  })
  registrar('CT-AUTH-09B', 'Somente a nova senha autentica depois da redefinicao',
    loginAntigo.status === 401 && loginNovo.status === 200,
    JSON.stringify({ loginAntigo: loginAntigo.status, loginNovo: loginNovo.status }))

  const reutilizacao = await fetch(`${api}/auth/reset-password`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, password: 'OutraSenhaBar46@2026' }),
  })
  const corpoReutilizacao = await reutilizacao.json().catch(() => ({}))
  registrar('CT-AUTH-09C', 'Token de recuperacao nao pode ser reutilizado',
    reutilizacao.status === 400,
    JSON.stringify({ status: reutilizacao.status, corpo: corpoReutilizacao }))

  const tokenExpirado = crypto.randomBytes(32).toString('hex')
  const hashExpirado = crypto.createHash('sha256').update(tokenExpirado).digest('hex')
  await pool.query(
    `INSERT INTO public.password_reset_tokens (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() - INTERVAL '1 minute')`,
    [usuarioId, hashExpirado]
  )
  const expirado = await fetch(`${api}/auth/reset-password`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: tokenExpirado, password: 'OutraSenhaBar46@2026' }),
  })
  registrar('CT-AUTH-09D', 'Token expirado e recusado', expirado.status === 400, `Status: ${expirado.status}`)

  const relatorio = {
    executadoEm: new Date().toISOString(),
    observacao: 'O recebimento do e-mail real exige validacao na caixa postal; token, interface, uso unico e login foram validados.',
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resultados,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-recuperacao-senha-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
  socket?.close()
  await pool.end().catch(() => {})
})

require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')

const api = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/wizard')
const resultados = []
let socket
let sequencia = 0
const pendentes = new Map()
let usuarioId = null
let clienteId = null
let agendamentoIds = []

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

async function navegar(rota, espera = 1700) {
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await esperar(espera)
}

async function capturar(nome) {
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, nome), Buffer.from(captura.data, 'base64'))
}

async function etapaAtual() {
  return avaliar(`document.querySelector('[aria-current="step"]')?.innerText || document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') || ''`)
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const marcador = Date.now()
  const email = `bar46.wizard.${marcador}@example.com`
  const cadastro = await fetch(`${api}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nome: 'Cliente Wizard BAR 46', email, telefone: '00000000000', password: 'TesteBar46@2026',
    }),
  })
  const conta = await cadastro.json()
  if (cadastro.status !== 201 || !conta.token || !conta.user?.id) {
    throw new Error(`Cadastro da conta temporaria falhou (${cadastro.status}): ${conta.message || ''}`)
  }
  usuarioId = conta.user.id
  const cliente = await pool.query('SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1', [usuarioId])
  clienteId = cliente.rows[0]?.idcliente
  if (!clienteId) throw new Error('Cliente temporario nao localizado.')

  await conectar()
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  })
  await navegar('/login', 500)
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(conta.token)}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify({ ...conta.user, nome: conta.user.name }))}); true`)
  await navegar('/agendar', 2200)

  const servico = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('main section button[aria-pressed]'))
      .find((item) => !item.disabled && item.offsetParent !== null)
    if (!botao) return null
    const texto = botao.innerText.trim()
    botao.click()
    return texto
  })()`)
  await esperar(900)
  registrar('CT-AGEND-16A', 'Wizard seleciona servico e avanca para profissional',
    Boolean(servico) && /Profissional/i.test(await etapaAtual()), JSON.stringify({ servico, etapa: await etapaAtual() }))

  const profissional = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('main section button[aria-pressed]'))
      .find((item) => !item.disabled && item.offsetParent !== null)
    if (!botao) return null
    const texto = botao.innerText.trim()
    botao.click()
    return texto
  })()`)
  await esperar(1500)
  registrar('CT-AGEND-16B', 'Wizard seleciona profissional e avanca para data',
    Boolean(profissional) && /Data/i.test(await etapaAtual()), JSON.stringify({ profissional, etapa: await etapaAtual() }))

  let dataEscolhida = null
  for (let tentativa = 0; tentativa < 7 && !dataEscolhida; tentativa += 1) {
    dataEscolhida = await avaliar(`(() => {
      const secao = Array.from(document.querySelectorAll('main section')).find((item) => !item.hidden && item.querySelector('.grid-cols-7'))
      if (!secao) return null
      const botao = Array.from(secao.querySelectorAll('button[aria-label]')).find((item) => !item.disabled && /\\d{4}/.test(item.getAttribute('aria-label') || ''))
      if (!botao) return null
      const rotulo = botao.getAttribute('aria-label')
      botao.click()
      return rotulo
    })()`)
    if (!dataEscolhida) {
      await avaliar(`(() => {
        const botoes = Array.from(document.querySelectorAll('main section button[aria-label]')).filter((item) => item.offsetParent !== null)
        botoes[botoes.length - 1]?.click()
        return true
      })()`)
      await esperar(1000)
    }
  }
  await esperar(1600)
  registrar('CT-AGEND-16C', 'Wizard seleciona dia disponivel e carrega horarios',
    Boolean(dataEscolhida) && /Horario/i.test(String(await etapaAtual()).normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
    JSON.stringify({ dataEscolhida, etapa: await etapaAtual() }))

  const horario = await avaliar(`(() => {
    const aside = Array.from(document.querySelectorAll('main aside')).find((item) => !item.hidden)
    const botao = Array.from(aside?.querySelectorAll('button[aria-pressed]') || []).find((item) => !item.disabled)
    if (!botao) return null
    const texto = botao.innerText.trim()
    botao.click()
    return texto
  })()`)
  await esperar(800)
  registrar('CT-AGEND-16D', 'Wizard seleciona horario e apresenta revisao',
    Boolean(horario) && /Confirmacao/i.test(String(await etapaAtual()).normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
    JSON.stringify({ horario, etapa: await etapaAtual() }))

  const dinheiro = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('button')).find((item) => /^Dinheiro/i.test(item.innerText.trim()))
    if (!botao) return false
    botao.click()
    return true
  })()`)
  await esperar(200)
  const resumo = await avaliar(`(() => ({
    texto: document.querySelector('main section:not([hidden])')?.innerText || '',
    dinheiroSelecionado: Array.from(document.querySelectorAll('button')).some((item) => /^Dinheiro/i.test(item.innerText.trim()) && item.getAttribute('aria-pressed') === 'true')
  }))()`)
  registrar('CT-AGEND-16E', 'Revisao mantem escolhas e permite pagamento em dinheiro',
    dinheiro && resumo.dinheiroSelecionado
      && ['Servico', 'Profissional', 'Data', 'Horario', 'Total no pagamento'].every((rotulo) => (
        String(resumo.texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(rotulo)
      )),
    JSON.stringify(resumo))

  const maxAntes = await pool.query(
    'SELECT COALESCE(MAX(idagendamento), 0)::integer AS id FROM public.agendamento WHERE cliente_idcliente = $1',
    [clienteId]
  )
  const acionouDuasVezes = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('button')).find((item) => /Confirmar e pagar em dinheiro/i.test(item.innerText))
    if (!botao) return false
    botao.click()
    botao.click()
    return true
  })()`)
  await esperar(4500)
  const criados = await pool.query(
    `SELECT a.idagendamento, a.statusagendamento, p.idpagamento, p.metodo, p.statuspagamento
     FROM public.agendamento a
     LEFT JOIN public.pagamento p ON p.agendamento_idagendamento = a.idagendamento
     WHERE a.cliente_idcliente = $1 AND a.idagendamento > $2
     ORDER BY a.idagendamento`,
    [clienteId, maxAntes.rows[0].id]
  )
  agendamentoIds = criados.rows.map((item) => item.idagendamento)
  const confirmacao = await avaliar(`(() => ({
    titulo: document.querySelector('h1')?.innerText || '',
    texto: document.body.innerText,
    alerta: document.querySelector('[role="alert"]')?.innerText || ''
  }))()`)
  await capturar('wizard-confirmado-mobile.png')
  registrar('CT-AGEND-16F', 'Confirmacao cria agendamento e pagamento em dinheiro coerentes',
    criados.rows.length === 1
      && criados.rows[0].statusagendamento === 'AGENDADO'
      && criados.rows[0].metodo === 'DINHEIRO'
      && criados.rows[0].statuspagamento === 'PENDENTE'
      && /Agendamento confirmado/i.test(confirmacao.titulo)
      && !confirmacao.alerta,
    JSON.stringify({ criados: criados.rows, confirmacao }))
  registrar('CT-UI-09', 'Duplo clique na confirmacao nao duplica o agendamento',
    acionouDuasVezes && criados.rows.length === 1,
    JSON.stringify({ acionouDuasVezes, criados: criados.rows }))

  const relatorio = {
    executadoEm: new Date().toISOString(),
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    resultados,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-wizard-resultados.json'), `${JSON.stringify(relatorio, null, 2)}\n`)
  console.log(JSON.stringify(relatorio, null, 2))
  if (relatorio.reprovados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 1
}).finally(async () => {
  if (agendamentoIds.length) {
    await pool.query('DELETE FROM public.whatsapp_notificacao WHERE agendamento_idagendamento = ANY($1::integer[])', [agendamentoIds]).catch(() => {})
    await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo IN ('AGENDAMENTO', 'PAGAMENTO') AND referencia_id = ANY($1::bigint[])", [agendamentoIds]).catch(() => {})
    await pool.query('DELETE FROM public.pagamento WHERE agendamento_idagendamento = ANY($1::integer[])', [agendamentoIds]).catch(() => {})
    await pool.query('DELETE FROM public.agendamento WHERE idagendamento = ANY($1::integer[])', [agendamentoIds]).catch(() => {})
  }
  if (usuarioId) await pool.query('DELETE FROM public.usuario WHERE idusuario = $1', [usuarioId]).catch(() => {})
  socket?.close()
  await pool.end().catch(() => {})
})

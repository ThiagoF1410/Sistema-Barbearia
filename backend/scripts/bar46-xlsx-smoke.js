require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')
const ExcelJS = require(path.resolve(__dirname, '../../frontend/node_modules/exceljs'))

const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const evidenceDir = path.resolve(__dirname, '../../documentos/testes/evidencias/xlsx')
const resultados = []
let socket
let sequencia = 0
const pendentes = new Map()

function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}

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
  await enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: evidenceDir, eventsEnabled: true })
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
  return resposta.result.value
}

async function aguardarArquivo(nome, limiteMs = 20000) {
  const arquivo = path.join(evidenceDir, nome)
  const inicio = Date.now()
  while (Date.now() - inicio < limiteMs) {
    if (fs.existsSync(arquivo) && !fs.existsSync(`${arquivo}.crdownload`)) return arquivo
    await esperar(250)
  }
  throw new Error(`Download não concluído: ${nome}`)
}

async function aguardarBotaoExportacao(limiteMs = 12000) {
  const inicio = Date.now()
  while (Date.now() - inicio < limiteMs) {
    const pronto = await avaliar(`(() => {
      const botao = Array.from(document.querySelectorAll('button')).find((item) => /Exportar Excel/i.test(item.innerText))
      return Boolean(botao && !botao.disabled)
    })()`)
    if (pronto) return true
    await esperar(250)
  }
  return false
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const admin = await pool.query(
    `SELECT u.idusuario, u.nome, u.email, u.token_version
     FROM public.usuario u JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
     ORDER BY u.idusuario LIMIT 1`
  )
  if (!admin.rows[0]) throw new Error('Administrador necessário.')
  const usuario = admin.rows[0]
  const jwt = signToken({ id: usuario.idusuario, email: usuario.email, role: 'admin', tokenVersion: usuario.token_version })
  const dadosUsuario = JSON.stringify({ idusuario: usuario.idusuario, nome: usuario.nome, email: usuario.email, role: 'admin' })
  const ano = new Date().getFullYear()
  const nomeAnual = `relatorio-${ano}-rei-da-navalha.xlsx`
  const nomeMensal = `relatorio-setembro-${ano}-rei-da-navalha.xlsx`
  for (const nome of [nomeAnual, nomeMensal]) {
    const arquivo = path.join(evidenceDir, nome)
    if (fs.existsSync(arquivo)) throw new Error(`A evidência já existe e não será sobrescrita: ${nome}`)
  }

  const api = await fetch(`${baseUrl}/pagamentos/admin/relatorio-mensal?ano=${ano}`, {
    headers: { authorization: `Bearer ${jwt}` },
  })
  const relatorio = await api.json()
  if (api.status !== 200) throw new Error(relatorio.message || 'Relatório da API indisponível.')

  await conectar()
  await enviar('Page.navigate', { url: `${frontend}/login` })
  await esperar(700)
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(jwt)}); localStorage.setItem('user', ${JSON.stringify(dadosUsuario)}); true`)
  await enviar('Page.navigate', { url: `${frontend}/admin/relatorios` })
  await esperar(3000)

  const botaoPronto = await aguardarBotaoExportacao()
  const clicouAnual = botaoPronto && await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('button')).find((item) => /Exportar Excel/i.test(item.innerText))
    if (!botao || botao.disabled) return false
    botao.click(); return true
  })()`)
  if (!clicouAnual) {
    const diagnostico = await avaliar(`({
      rota: location.pathname,
      texto: document.body.innerText.slice(-500),
      botoes: Array.from(document.querySelectorAll('button')).map((item) => ({ texto: item.innerText, disabled: item.disabled }))
    })`)
    throw new Error(`Exportação anual indisponível: ${JSON.stringify(diagnostico)}`)
  }
  const arquivoAnual = await aguardarArquivo(nomeAnual)
  registrar('CT-ADMIN-21A', 'Baixar planilha anual pela interface', Boolean(arquivoAnual), 'Botão indisponível ou download ausente.')

  const selecionouMes = await avaliar(`(() => {
    const seletor = document.querySelector('#mes-exportacao')
    if (!seletor) return false
    seletor.value = '9'
    seletor.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await esperar(200)
  await aguardarBotaoExportacao()
  const clicouMensal = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('button')).find((item) => /Exportar Excel/i.test(item.innerText))
    if (!botao || botao.disabled) return false
    botao.click(); return true
  })()`)
  const arquivoMensal = selecionouMes && clicouMensal ? await aguardarArquivo(nomeMensal) : null
  registrar('CT-ADMIN-21B', 'Baixar planilha de um mês específico', Boolean(arquivoMensal), 'Seleção mensal ou download falhou.')

  const workbookAnual = new ExcelJS.Workbook()
  await workbookAnual.xlsx.readFile(arquivoAnual)
  const planilhaAnual = workbookAnual.getWorksheet('Relatório') || workbookAnual.worksheets[0]
  const totalApi = relatorio.totais
  const linhaTotalAnual = planilhaAnual.getRow(18)
  const estruturaAnual = planilhaAnual.rowCount === 18
    && planilhaAnual.getCell('A1').isMerged
    && planilhaAnual.views[0]?.state === 'frozen'
    && planilhaAnual.views[0]?.ySplit === 5
    && Boolean(planilhaAnual.autoFilter)
    && planilhaAnual.getCell('A1').font?.bold
    && planilhaAnual.getCell('A1').fill?.fgColor?.argb === 'FF0B0B0B'
    && planilhaAnual.getCell('A5').fill?.fgColor?.argb === 'FFF4C84A'
    && planilhaAnual.getCell('F6').numFmt === 'R$ #,##0.00'
  registrar('CT-ADMIN-21C', 'Planilha anual possui título, cores, filtro, congelamento e moeda',
    estruturaAnual, `Linhas: ${planilhaAnual.rowCount}`)
  const totaisConferem = Number(linhaTotalAnual.getCell(2).value) === Number(totalApi.total_agendamentos)
    && Number(linhaTotalAnual.getCell(3).value) === Number(totalApi.concluidos)
    && Number(linhaTotalAnual.getCell(4).value) === Number(totalApi.cancelados)
    && Number(linhaTotalAnual.getCell(5).value) === Number(totalApi.pagamentos_confirmados)
    && Number(linhaTotalAnual.getCell(6).value) === Number(totalApi.faturamento)
  registrar('CT-ADMIN-21D', 'Totais da planilha anual conferem com a API',
    totaisConferem, JSON.stringify({ planilha: linhaTotalAnual.values.slice(1), api: totalApi }))

  const workbookMensal = new ExcelJS.Workbook()
  await workbookMensal.xlsx.readFile(arquivoMensal)
  const planilhaMensal = workbookMensal.getWorksheet('Relatório') || workbookMensal.worksheets[0]
  const setembro = relatorio.meses.find((item) => Number(item.mes) === 9)
  const linhaMes = planilhaMensal.getRow(6)
  const linhaTotalMes = planilhaMensal.getRow(7)
  const mensalCorreto = planilhaMensal.rowCount === 7
    && /Setembro/i.test(String(planilhaMensal.getCell('A2').value))
    && linhaMes.getCell(1).value === 'Setembro'
    && Number(linhaTotalMes.getCell(2).value) === Number(setembro.total_agendamentos)
    && Number(linhaTotalMes.getCell(6).value) === Number(setembro.faturamento)
  registrar('CT-ADMIN-21E', 'Planilha mensal contém somente o mês e seus totais',
    mensalCorreto, JSON.stringify({ linhas: planilhaMensal.rowCount, mes: linhaMes.values, total: linhaTotalMes.values }))

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
  }
  fs.writeFileSync(path.join(evidenceDir, 'bar46-xlsx-resultados.json'), `${JSON.stringify({ resumo, resultados }, null, 2)}\n`)
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha inesperada na exportação XLSX.', detalhe: erro.message }))
    process.exitCode = 1
  })
  .finally(async () => {
    socket?.close()
    await pool.end()
  })

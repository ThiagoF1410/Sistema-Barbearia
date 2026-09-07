const fs = require('fs')
const path = require('path')

const raiz = path.resolve(__dirname, '..', '..')
const apiPath = path.join(raiz, 'documentos', 'API.md')
const readmePath = path.join(raiz, 'README.md')
const api = fs.readFileSync(apiPath, 'utf8')
const readme = fs.readFileSync(readmePath, 'utf8')

const arquivosRotas = {
  auth: 'authRoutes.js',
  clientes: 'clientesRoutes.js',
  servicos: 'servicosRoutes.js',
  agenda: 'agendaRoutes.js',
  profissionais: 'profissionaisRoutes.js',
  agendamentos: 'agendamentosRoutes.js',
  pagamentos: 'pagamentosRoutes.js',
  pedidos: 'pedidosRoutes.js',
  whatsapp: 'whatsappRoutes.js',
  notificacoes: 'notificacoesRoutes.js',
}

const ausentes = []
let rotasVerificadas = 0
const padraoRota = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g

for (const [base, arquivo] of Object.entries(arquivosRotas)) {
  const conteudo = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', arquivo), 'utf8')
  for (const correspondencia of conteudo.matchAll(padraoRota)) {
    const metodo = correspondencia[1].toUpperCase()
    const sufixo = correspondencia[2] === '/' ? '' : correspondencia[2]
    const rota = `/${base}${sufixo}`
    rotasVerificadas += 1
    if (!api.includes(`\`${metodo} ${rota}\``)) ausentes.push(`${metodo} ${rota}`)
  }
}

// O webhook é registrado diretamente em server.js para preservar o corpo bruto.
rotasVerificadas += 1
if (!api.includes('`POST /pagamentos/webhook`')) ausentes.push('POST /pagamentos/webhook')

const linksAusentes = []
for (const correspondencia of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const destino = correspondencia[1]
  if (/^[a-z]+:/i.test(destino) || destino.startsWith('#')) continue
  if (!fs.existsSync(path.resolve(raiz, destino))) linksAusentes.push(destino)
}

const resultado = {
  rotasVerificadas,
  rotasAusentesNaDocumentacao: ausentes,
  linksReadmeAusentes: linksAusentes,
}

console.log(JSON.stringify(resultado, null, 2))
if (ausentes.length || linksAusentes.length) process.exitCode = 1

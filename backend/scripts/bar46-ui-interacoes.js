require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const frontend = process.env.BAR46_FRONTEND_URL || 'http://localhost:5173'
const cdpUrl = process.env.BAR46_CDP_URL || 'http://127.0.0.1:9222'
const apiPattern = `${new URL(frontend).origin}/api/*`
const evidenceDir = process.env.BAR46_EVIDENCE_DIR
  ? path.resolve(process.env.BAR46_EVIDENCE_DIR)
  : path.resolve(__dirname, '../../documentos/testes/evidencias')
const browserLabel = process.env.BAR46_BROWSER_LABEL || 'Edge'
const resultFile = process.env.BAR46_RESULT_FILE || 'bar46-ui-interacoes-resultados.json'
const resultados = []
let socket
let sequencia = 0
const pendentes = new Map()
let fixtureAgendamento = null
let fixtureAgenda = null

function registrar(id, descricao, aprovado, detalhe = '') {
  resultados.push({ id, descricao, resultado: aprovado ? 'APROVADO' : 'REPROVADO', detalhe: aprovado ? '' : detalhe })
}

function esperar(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function conectar() {
  const alvos = await fetch(`${cdpUrl}/json`).then((resposta) => resposta.json())
  const alvo = alvos.find((item) => item.type === 'page')
  if (!alvo) throw new Error(`Nenhuma página disponível no ${browserLabel} via CDP.`)
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
  await enviar('Network.enable')
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

async function navegar(rota, espera = 2200) {
  await enviar('Page.navigate', { url: `${frontend}${rota}` })
  await esperar(espera)
}

async function viewport(width, height) {
  await enviar('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
}

async function capturar(nome) {
  const captura = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(evidenceDir, nome), Buffer.from(captura.data, 'base64'))
}

function token(usuario, role = 'cliente') {
  return signToken({
    id: usuario.idusuario,
    email: usuario.email,
    role,
    tokenVersion: usuario.token_version,
  })
}

async function preparar(usuario, role, rota, largura = 1365, altura = 900) {
  await viewport(largura, altura)
  await navegar('/login', 700)
  const dados = {
    id: usuario.idusuario,
    idusuario: usuario.idusuario,
    nome: usuario.nome,
    name: usuario.nome,
    email: usuario.email,
    role,
  }
  await avaliar(`localStorage.setItem('token', ${JSON.stringify(token(usuario, role))}); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(dados))}); true`)
  await navegar(rota)
}

async function identidades() {
  const [admin, comAgenda, semAgenda, comHistorico, produto, servico, profissional] = await Promise.all([
    pool.query(`SELECT u.idusuario, u.nome, u.email, u.token_version
      FROM public.usuario u JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
      ORDER BY u.idusuario LIMIT 1`),
    pool.query(`SELECT u.idusuario, u.nome, u.email, u.token_version,
        COUNT(a.idagendamento) FILTER (WHERE a.statusagendamento = 'AGENDADO'
          AND a.dataagendamento + a.horario > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') AS futuros
      FROM public.usuario u JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
      LEFT JOIN public.agendamento a ON a.cliente_idcliente = c.idcliente
      GROUP BY u.idusuario ORDER BY futuros DESC, u.idusuario LIMIT 1`),
    pool.query(`SELECT u.idusuario, u.nome, u.email, u.token_version
      FROM public.usuario u JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
      WHERE u.email LIKE 'bar46.%' AND NOT EXISTS (
        SELECT 1 FROM public.agendamento a WHERE a.cliente_idcliente = c.idcliente
          AND a.statusagendamento = 'AGENDADO'
          AND a.dataagendamento + a.horario > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY u.idusuario DESC LIMIT 1`),
    pool.query(`SELECT u.idusuario, u.nome, u.email, u.token_version, COUNT(a.idagendamento) AS total
      FROM public.usuario u JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
      JOIN public.agendamento a ON a.cliente_idcliente = c.idcliente
      GROUP BY u.idusuario ORDER BY total DESC, u.idusuario LIMIT 1`),
    pool.query("SELECT idservico FROM public.servico WHERE tipo = 'produto' ORDER BY idservico LIMIT 1"),
    pool.query("SELECT idservico, nome, duracao, preco FROM public.servico WHERE tipo = 'servico' ORDER BY duracao, idservico LIMIT 1"),
    pool.query('SELECT idprofissional FROM public.profissional WHERE ativo = TRUE ORDER BY idprofissional LIMIT 1'),
  ])
  return {
    admin: admin.rows[0], comAgenda: comAgenda.rows[0], semAgenda: semAgenda.rows[0],
    comHistorico: comHistorico.rows[0], produto: produto.rows[0],
    servico: servico.rows[0], profissional: profissional.rows[0],
  }
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true })
  const perfis = await identidades()
  if (!perfis.admin || !perfis.semAgenda || !perfis.comHistorico || !perfis.produto || !perfis.servico || !perfis.profissional) {
    throw new Error('Dados de cliente, administrador, histórico e produto são necessários.')
  }
  await conectar()

  await preparar(perfis.semAgenda, 'cliente', '/admin/agendamentos')
  const rotaProtegida = await avaliar('location.pathname')
  registrar('CT-SEC-04', 'Cliente é redirecionado ao tentar abrir área administrativa',
    rotaProtegida === '/dashboard', `Rota obtida: ${rotaProtegida}`)

  await navegar('/rota-inexistente')
  const rotaInexistente = await avaliar('location.pathname')
  registrar('CT-UI-08', 'Rota inexistente retorna para página segura',
    rotaInexistente === '/inicio', `Rota obtida: ${rotaInexistente}`)

  await preparar(perfis.admin, 'admin', '/admin/agendamentos')
  const menu = await avaliar(`(() => ({
    total: document.querySelectorAll('a[aria-current="page"]').length,
    texto: document.querySelector('a[aria-current="page"]')?.innerText.trim()
  }))()`)
  registrar('CT-UI-05', 'Somente a rota administrativa atual fica selecionada',
    menu.total === 1 && menu.texto === 'Agendamentos', JSON.stringify(menu))

  await viewport(390, 844)
  await navegar('/admin/agendamentos')
  const abriuCalendario = await avaliar(`(() => { document.querySelector('#filtro-agendamento-inicio')?.click(); return true })()`)
  await esperar(500)
  const calendario = await avaliar(`(() => {
    const dialogo = document.querySelector('[role="dialog"]')
    if (!dialogo) return { existe: false }
    const caixa = dialogo.getBoundingClientRect()
    const elementoCentro = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2)
    return {
      existe: true,
      zIndex: getComputedStyle(dialogo).zIndex,
      corpoBloqueado: document.body.style.overflow === 'hidden',
      noTopo: dialogo.contains(elementoCentro),
      dentroDaTela: caixa.left >= 0 && caixa.right <= innerWidth && caixa.top >= 0 && caixa.bottom <= innerHeight
    }
  })()`)
  await capturar('admin-calendario-aberto-390.png')
  registrar('CT-UI-06', 'Calendário abre em primeiro plano e dentro da tela móvel',
    abriuCalendario && calendario.existe && calendario.noTopo && calendario.corpoBloqueado && calendario.dentroDaTela,
    JSON.stringify(calendario))
  await avaliar(`document.querySelector('button[aria-label="Fechar"]')?.click(); true`)

  await preparar(perfis.semAgenda, 'cliente', '/loja?aba=pedidos', 390, 844)
  let abas = await avaliar(`Array.from(document.querySelectorAll('[role="tab"]')).map((item) => ({ texto: item.innerText, selecionada: item.getAttribute('aria-selected') }))`)
  const iniciouPedidos = abas.some((item) => /Meus pedidos/i.test(item.texto) && item.selecionada === 'true')
  await avaliar(`Array.from(document.querySelectorAll('[role="tab"]')).find((item) => /Produtos/i.test(item.innerText))?.click(); true`)
  await esperar(300)
  abas = await avaliar(`Array.from(document.querySelectorAll('[role="tab"]')).map((item) => ({ texto: item.innerText, selecionada: item.getAttribute('aria-selected') }))`)
  const alternouProdutos = abas.some((item) => /^Produtos/i.test(item.texto.trim()) && item.selecionada === 'true')
  await avaliar(`Array.from(document.querySelectorAll('[role="tab"]')).find((item) => /Meus pedidos/i.test(item.innerText))?.click(); true`)
  await esperar(300)
  abas = await avaliar(`Array.from(document.querySelectorAll('[role="tab"]')).map((item) => ({ texto: item.innerText, selecionada: item.getAttribute('aria-selected') }))`)
  const voltouPedidos = abas.some((item) => /Meus pedidos/i.test(item.texto) && item.selecionada === 'true')
  registrar('CT-UI-03', 'Abas Produtos e Meus pedidos alternam corretamente no mobile',
    iniciouPedidos && alternouProdutos && voltouPedidos, JSON.stringify(abas))

  const chaveCarrinho = 'rei-da-navalha:carrinho'
  const produtoId = String(perfis.produto.idservico)
  await avaliar(`localStorage.setItem(${JSON.stringify(chaveCarrinho)}, JSON.stringify({ ${JSON.stringify(produtoId)}: 2 })); true`)
  await navegar('/sacola')
  const controlesSacola = await avaliar(`(() => ({
    aumentar: Boolean(document.querySelector('[aria-label^="Aumentar quantidade"]')),
    remover: Boolean(document.querySelector('[aria-label^="Remover "]')),
    esvaziar: Array.from(document.querySelectorAll('button')).some((item) => item.innerText.trim() === 'Esvaziar sacola')
  }))()`)
  await avaliar(`document.querySelector('[aria-label^="Aumentar quantidade"]')?.click(); true`)
  await esperar(250)
  const quantidadeTres = await avaliar(`JSON.parse(localStorage.getItem(${JSON.stringify(chaveCarrinho)}) || '{}')[${JSON.stringify(produtoId)}] === 3`)
  await avaliar(`document.querySelector('[aria-label^="Remover "]')?.click(); true`)
  await esperar(250)
  const removeu = await avaliar(`!localStorage.getItem(${JSON.stringify(chaveCarrinho)}) && document.body.innerText.includes('Sua sacola está vazia')`)
  registrar('CT-UI-04A', 'Sacola permite alterar quantidade e remover produto',
    controlesSacola.aumentar && controlesSacola.remover && quantidadeTres && removeu,
    JSON.stringify({ controlesSacola, quantidadeTres, removeu }))

  await avaliar(`localStorage.setItem(${JSON.stringify(chaveCarrinho)}, JSON.stringify({ ${JSON.stringify(produtoId)}: 1 })); true`)
  await navegar('/sacola')
  await avaliar(`Array.from(document.querySelectorAll('button')).find((item) => item.innerText.trim() === 'Esvaziar sacola')?.click(); true`)
  await esperar(250)
  const confirmouModal = await avaliar(`(() => {
    const botoes = Array.from(document.querySelectorAll('button')).filter((item) => item.innerText.trim() === 'Esvaziar sacola')
    if (botoes.length < 2) return false
    botoes[botoes.length - 1].click()
    return true
  })()`)
  await esperar(250)
  const esvaziou = await avaliar(`!localStorage.getItem(${JSON.stringify(chaveCarrinho)}) && document.body.innerText.includes('Sua sacola está vazia')`)
  registrar('CT-UI-04B', 'Esvaziar sacola exige confirmação e remove todos os itens',
    confirmouModal && esvaziou, JSON.stringify({ confirmouModal, esvaziou }))

  await preparar(perfis.semAgenda, 'cliente', '/dashboard')
  const vazio = await avaliar(`/Sua agenda está livre|nenhum horário futuro/i.test(document.body.innerText)`)
  const clienteFixture = await pool.query(
    'SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1', [perfis.semAgenda.idusuario]
  )
  const dataFixture = await pool.query(
    "SELECT TO_CHAR((CURRENT_DATE + INTERVAL '900 days')::date, 'YYYY-MM-DD') AS data"
  )
  const agendaFixture = await pool.query(
    `INSERT INTO public.agenda (data, disponivel) VALUES ($1::date, TRUE)
     ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data RETURNING idagenda`,
    [dataFixture.rows[0].data]
  )
  fixtureAgenda = agendaFixture.rows[0].idagenda
  const agendamentoFixture = await pool.query(
    `INSERT INTO public.agendamento
      (agenda_idagenda, cliente_idcliente, profissional_idprofissional,
       servico_idservico, dataagendamento, horario, statusagendamento,
       servico_nome_snapshot, duracao_snapshot, valor_snapshot)
     VALUES ($1, $2, $3, $4, $5::date, '06:00', 'AGENDADO', $6, $7, $8)
     RETURNING idagendamento`,
    [fixtureAgenda, clienteFixture.rows[0].idcliente, perfis.profissional.idprofissional,
      perfis.servico.idservico, dataFixture.rows[0].data, perfis.servico.nome,
      perfis.servico.duracao, perfis.servico.preco]
  )
  fixtureAgendamento = agendamentoFixture.rows[0].idagendamento
  const respostaFixture = await fetch(`${process.env.BAR46_API_URL || 'http://localhost:3001/api'}/agendamentos/meus`, {
    headers: { authorization: `Bearer ${token(perfis.semAgenda, 'cliente')}` },
  })
  const listaFixture = await respostaFixture.json()
  await preparar(perfis.semAgenda, 'cliente', '/dashboard')
  const painelPreenchido = await avaliar(`({
    temServico: document.body.innerText.includes(${JSON.stringify(perfis.servico.nome)}),
    vazio: /Sua agenda está livre/i.test(document.body.innerText),
    trecho: document.body.innerText.slice(-700)
  })`)
  const preenchido = respostaFixture.status === 200
    && listaFixture.some((item) => item.idagendamento === fixtureAgendamento)
    && painelPreenchido.temServico && !painelPreenchido.vazio
  await capturar('cliente-dashboard-preenchido-390.png')
  registrar('CT-UI-01', 'Dashboard apresenta estados vazio e preenchido',
    vazio && preenchido, JSON.stringify({ vazio, preenchido, api: respostaFixture.status, painelPreenchido }))

  await preparar(perfis.comHistorico, 'cliente', '/historico', 390, 844)
  const filtrosAntes = await avaliar(`Array.from(document.querySelectorAll('button[aria-pressed]')).map((item) => ({ texto: item.innerText, pressionado: item.getAttribute('aria-pressed') }))`)
  const filtroCanceladoExiste = filtrosAntes.some((item) => /Cancelado/i.test(item.texto))
  await avaliar(`Array.from(document.querySelectorAll('button[aria-pressed]')).find((item) => /Cancelado/i.test(item.innerText))?.click(); true`)
  await esperar(300)
  const filtroDepois = await avaliar(`Array.from(document.querySelectorAll('button[aria-pressed]')).filter((item) => item.getAttribute('aria-pressed') === 'true').map((item) => item.innerText)`)
  registrar('CT-UI-02', 'Filtros e contadores do histórico respondem no mobile',
    filtroCanceladoExiste && filtroDepois.length === 1 && /Cancelado/i.test(filtroDepois[0]), JSON.stringify(filtroDepois))

  await preparar(perfis.semAgenda, 'cliente', '/dashboard')
  const clicouSair = await avaliar(`(() => {
    const botao = Array.from(document.querySelectorAll('button')).find((item) => item.innerText.includes('Sair'))
    botao?.click(); return Boolean(botao)
  })()`)
  await esperar(700)
  const logout = await avaliar(`({ rota: location.pathname, token: localStorage.getItem('token'), usuario: localStorage.getItem('user') })`)
  registrar('CT-AUTH-10', 'Logout remove a sessão e redireciona ao login',
    clicouSair && logout.rota === '/login' && !logout.token && !logout.usuario, JSON.stringify(logout))

  await navegar('/login', 500)
  const usuarioInvalido = { idusuario: perfis.semAgenda.idusuario, nome: perfis.semAgenda.nome, email: perfis.semAgenda.email, role: 'cliente' }
  await avaliar(`localStorage.setItem('token', 'token.invalido.bar46'); localStorage.setItem('user', ${JSON.stringify(JSON.stringify(usuarioInvalido))}); true`)
  await navegar('/dashboard', 2800)
  const jwtInvalido = await avaliar(`({
    rota: location.pathname,
    token: localStorage.getItem('token'),
    alerta: document.querySelector('[role="alert"]')?.innerText || ''
  })`)
  registrar('CT-AUTH-11A', 'JWT inválido encerra a sessão e redireciona',
    jwtInvalido.rota === '/login' && !jwtInvalido.token, JSON.stringify(jwtInvalido))
  registrar('CT-AUTH-11B', 'JWT inválido apresenta mensagem apropriada',
    /sessão|autenticar|entre novamente|expir/i.test(jwtInvalido.alerta),
    jwtInvalido.alerta || 'Nenhuma mensagem de sessão expirada foi apresentada.')
  await capturar('cliente-jwt-invalido-login-390.png')

  await preparar(perfis.semAgenda, 'cliente', '/dashboard', 390, 844)
  await enviar('Network.setBlockedURLs', { urls: [apiPattern] })
  const abriuLojaSemRecarregar = await avaliar(`(() => {
    const link = document.querySelector('a[href="/loja"]')
    link?.click()
    return Boolean(link)
  })()`)
  await esperar(1800)
  const falhaRede = await avaliar(`({
    rota: location.pathname,
    texto: document.body.innerText,
    tecnico: /Request failed|status code|ECONN|Network Error|TypeError/i.test(document.body.innerText),
    formal: /Não foi possível conectar ao servidor|temporariamente indisponível|Não foi possível carregar o catálogo/i.test(document.body.innerText)
  })`)
  registrar('CT-UI-07', 'Falha de comunicação exibe mensagem formal sem detalhe técnico',
    abriuLojaSemRecarregar && falhaRede.rota === '/loja' && falhaRede.formal && !falhaRede.tecnico,
    falhaRede.texto.slice(0, 250))
  await enviar('Network.setBlockedURLs', { urls: [] })

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
  }
  const relatorio = { geradoEm: new Date().toISOString(), resumo, resultados }
  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(path.join(evidenceDir, resultFile), `${JSON.stringify({ ...relatorio, navegador: browserLabel }, null, 2)}\n`)
  console.log(JSON.stringify({ resumo, reprovados: resultados.filter((item) => item.resultado === 'REPROVADO') }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha inesperada nas interações de interface.', detalhe: erro.message }))
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (socket?.readyState === WebSocket.OPEN) await enviar('Network.setBlockedURLs', { urls: [] })
      if (fixtureAgendamento) {
        await pool.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'agendamento' AND referencia_id = $1", [fixtureAgendamento])
        await pool.query('DELETE FROM public.pagamento WHERE agendamento_idagendamento = $1', [fixtureAgendamento])
        await pool.query('DELETE FROM public.agendamento WHERE idagendamento = $1', [fixtureAgendamento])
      }
      if (fixtureAgenda) {
        await pool.query(`DELETE FROM public.agenda ag WHERE idagenda = $1
          AND NOT EXISTS (SELECT 1 FROM public.agendamento a WHERE a.agenda_idagenda = ag.idagenda)`, [fixtureAgenda])
      }
    } finally {
      socket?.close()
      await pool.end()
    }
  })

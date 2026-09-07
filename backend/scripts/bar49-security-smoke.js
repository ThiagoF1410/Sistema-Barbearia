require('dotenv').config()

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const baseUrl = process.env.BAR49_API_URL || 'http://localhost:3001/api'
const resultados = []

function registrar(id, descricao, aprovado, detalhe) {
  resultados.push({
    id,
    descricao,
    resultado: aprovado ? 'APROVADO' : 'REPROVADO',
    detalhe,
  })
}

async function requisitar(caminho, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, opcoes)
  let corpo = null
  try { corpo = await resposta.json() } catch { /* resposta sem JSON */ }
  return { resposta, corpo }
}

async function testarCabecalhos() {
  const { resposta } = await requisitar('/servicos')
  const verificacoes = {
    status: resposta.status === 200,
    tecnologiaOculta: !resposta.headers.has('x-powered-by'),
    mimeSniffing: resposta.headers.get('x-content-type-options') === 'nosniff',
    iframe: resposta.headers.get('x-frame-options') === 'DENY',
    cache: resposta.headers.get('cache-control') === 'no-store',
    csp: Boolean(resposta.headers.get('content-security-policy')),
    permissoes: Boolean(resposta.headers.get('permissions-policy')),
  }
  registrar('SEC-HTTP-01', 'Cabeçalhos defensivos e ocultação da tecnologia',
    Object.values(verificacoes).every(Boolean), verificacoes)
}

async function testarCors() {
  const { resposta } = await requisitar('/servicos', {
    headers: { origin: 'https://origem-maliciosa.example' },
  })
  const aprovado = resposta.status === 403
    && !resposta.headers.has('access-control-allow-origin')
  registrar('SEC-CORS-01', 'Origem externa não autorizada', aprovado, {
    statusHttp: resposta.status,
    origemLiberada: resposta.headers.has('access-control-allow-origin'),
  })
}

async function testarPayloadGrande() {
  const { resposta, corpo } = await requisitar('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${'a'.repeat(33 * 1024)}@example.com`, password: 'Senha123!' }),
  })
  registrar('SEC-HTTP-02', 'Payload JSON acima de 32 kB', resposta.status === 413, {
    statusHttp: resposta.status,
    mensagemFormal: typeof corpo?.message === 'string' && !/stack|syntax|express/i.test(corpo.message),
  })
}

async function obterCliente() {
  const resultado = await pool.query(`
    SELECT u.idusuario, u.email, u.token_version
    FROM public.usuario u
    JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
    ORDER BY u.idusuario DESC
    LIMIT 1
  `)
  return resultado.rows[0]
}

function tokenDireto(payload, opcoes = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'rei-da-navalha-api',
    audience: 'rei-da-navalha-web',
    expiresIn: '5m',
    ...opcoes,
  })
}

async function testarToken(id, descricao, token, statusEsperado) {
  const { resposta } = await requisitar('/clientes/gestao', {
    headers: { authorization: `Bearer ${token}` },
  })
  registrar(id, descricao, resposta.status === statusEsperado, {
    statusHttp: resposta.status,
    statusEsperado,
  })
}

async function testarJwtEPerfis() {
  const cliente = await obterCliente()
  if (!cliente) {
    registrar('SEC-AUTH-00', 'Identidade de cliente disponível para auditoria', false,
      'Nenhum cliente cadastrado; não foi possível executar os ataques controlados.')
    return
  }

  const payload = {
    id: cliente.idusuario,
    email: cliente.email,
    role: 'cliente',
    tokenVersion: cliente.token_version,
  }
  const tokenCliente = signToken(payload)
  const tokenRoleForjado = signToken({ ...payload, role: 'admin' })
  const tokenSemContexto = jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: '5m',
  })
  const tokenExpirado = tokenDireto(payload, { expiresIn: '-1s' })
  const tokenIdInvalido = tokenDireto({ ...payload, id: String(payload.id) })
  const { tokenVersion, ...semVersao } = payload
  const tokenSemVersao = tokenDireto(semVersao)

  await testarToken('SEC-AUTH-01', 'Rota administrativa sem autenticação', '', 401)
  await testarToken('SEC-AUTH-02', 'Cliente impedido de acessar rota administrativa', tokenCliente, 403)
  await testarToken('SEC-AUTH-03', 'Perfil admin forjado no JWT não eleva privilégios', tokenRoleForjado, 403)
  await testarToken('SEC-AUTH-04', 'JWT sem emissor e audiência é recusado', tokenSemContexto, 401)
  await testarToken('SEC-AUTH-05', 'JWT expirado é recusado', tokenExpirado, 401)
  await testarToken('SEC-AUTH-06', 'JWT com identificador malformado é recusado', tokenIdInvalido, 401)
  await testarToken('SEC-AUTH-07', 'JWT sem versão de sessão é recusado', tokenSemVersao, 401)
}

async function testarHashes() {
  const consulta = await pool.query('SELECT senha FROM public.usuario')
  const hashes = consulta.rows.map((linha) => linha.senha)
  const formatoValido = hashes.every((hash) => /^\$2[aby]\$\d{2}\$/.test(hash))
  const custos = hashes.map((hash) => {
    try { return bcrypt.getRounds(hash) } catch { return 0 }
  })
  const custoAdequado = custos.every((custo) => custo >= 10)
  registrar('SEC-BCRYPT-01', 'Senhas persistidas somente como hash bcrypt com custo mínimo 10',
    hashes.length > 0 && formatoValido && custoAdequado, {
      usuariosVerificados: hashes.length,
      formatoValido,
      menorCusto: custos.length ? Math.min(...custos) : null,
    })
}

async function testarAmbiente() {
  const duracaoValida = /^\d+[smhd]$/.test(process.env.JWT_EXPIRES_IN || '')
  const verificacoes = {
    jwtDefinido: Boolean(process.env.JWT_SECRET),
    jwtMinimo32: (process.env.JWT_SECRET || '').length >= 32,
    jwtNaoExemplo: !/(change|changeme|example|exemplo|secret|segredo|troque|replace)/i.test(process.env.JWT_SECRET || ''),
    duracaoJwtValida: duracaoValida,
    stripeModoCoerente: process.env.STRIPE_MODE === 'live'
      ? (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live_')
      : (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_'),
  }
  registrar('SEC-ENV-01', 'Configuração local possui valores mínimos sem expor segredos',
    Object.values(verificacoes).every(Boolean), verificacoes)
}

async function main() {
  await testarCabecalhos()
  await testarCors()
  await testarPayloadGrande()
  await testarJwtEPerfis()
  await testarHashes()
  await testarAmbiente()

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
  }
  console.log(JSON.stringify({ executadoEm: new Date().toISOString(), resumo, resultados }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({
      erro: 'Falha inesperada na auditoria de segurança.',
      detalhe: erro.message || erro.code || 'Erro sem mensagem.',
    }))
    process.exitCode = 1
  })
  .finally(() => pool.end())

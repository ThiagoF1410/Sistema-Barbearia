const crypto = require('crypto')
const pool = require('../config/db')
const { registrarErro } = require('../utils/logger')

const tentativas = new Map()
let proximaLimpezaBanco = 0

const limpeza = setInterval(() => {
  const agora = Date.now()
  for (const [chave, registro] of tentativas) {
    if (registro.expiraEm <= agora) tentativas.delete(chave)
  }
}, 10 * 60 * 1000)
limpeza.unref()

function hashChave(chave) {
  return crypto.createHash('sha256').update(String(chave)).digest('hex')
}

function identidadeRequisicao(req) {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (email) return `email:${email}`
  const telefone = String(req.body?.telefone || '').replace(/\D/g, '')
  return telefone ? `telefone:${telefone}` : ''
}

function chavesAutenticacao(req) {
  const rota = `${req.baseUrl}${req.path}`
  const identidade = identidadeRequisicao(req)
  return [
    `auth:ip:${req.ip}:${rota}`,
    ...(identidade ? [`auth:identidade:${identidade}:${rota}`] : []),
  ]
}

function aplicarRespostaLimite(res, mensagem, expiraEm) {
  const segundos = Math.max(1, Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 1000))
  res.set('Retry-After', String(segundos))
  return res.status(429).json({ message: mensagem })
}

function registrarTentativaMemoria(chave, janelaMs, limite) {
  const agora = Date.now()
  const registro = tentativas.get(chave)

  if (!registro || registro.expiraEm <= agora) {
    const novo = { quantidade: 1, expiraEm: agora + janelaMs }
    tentativas.set(chave, novo)
    return { bloqueado: false, expiraEm: novo.expiraEm }
  }

  if (registro.quantidade >= limite) {
    return { bloqueado: true, expiraEm: registro.expiraEm }
  }

  registro.quantidade += 1
  return { bloqueado: false, expiraEm: registro.expiraEm }
}

async function registrarTentativaBanco(chave, janelaMs, limite) {
  const { rows } = await pool.query(
    `INSERT INTO controle_taxa (chave, quantidade, expira_em)
     VALUES ($1, 1, NOW() + ($2::bigint * INTERVAL '1 millisecond'))
     ON CONFLICT (chave) DO UPDATE SET
       quantidade = CASE
         WHEN controle_taxa.expira_em <= NOW() THEN 1
         ELSE controle_taxa.quantidade + 1
       END,
       expira_em = CASE
         WHEN controle_taxa.expira_em <= NOW() THEN EXCLUDED.expira_em
         ELSE controle_taxa.expira_em
       END
     RETURNING quantidade, expira_em`,
    [hashChave(chave), janelaMs],
  )

  if (Date.now() >= proximaLimpezaBanco) {
    proximaLimpezaBanco = Date.now() + 60 * 60 * 1000
    pool.query("DELETE FROM controle_taxa WHERE expira_em < NOW() - INTERVAL '1 day'")
      .catch((erro) => registrarErro('Falha ao limpar controles de taxa expirados:', erro))
  }

  return {
    bloqueado: Number(rows[0].quantidade) > limite,
    expiraEm: rows[0].expira_em,
  }
}

function criarLimitador({ janelaMs, limite, mensagem, obterChave, obterChaves }) {
  return async (req, res, next) => {
    const chaves = obterChaves
      ? obterChaves(req).map(String)
      : [obterChave ? String(obterChave(req)) : `${req.ip}:${req.baseUrl}${req.path}`]

    try {
      for (const chave of [...new Set(chaves)]) {
        const resultado = process.env.NODE_ENV === 'production'
          ? await registrarTentativaBanco(chave, janelaMs, limite)
          : registrarTentativaMemoria(chave, janelaMs, limite)
        if (resultado.bloqueado) return aplicarRespostaLimite(res, mensagem, resultado.expiraEm)
      }
    } catch (erro) {
      registrarErro('Falha no armazenamento compartilhado do rate limit:', erro)
      const chaveContingencia = `contingencia:${req.ip}:${req.baseUrl}${req.path}`
      const contingencia = registrarTentativaMemoria(chaveContingencia, janelaMs, limite)
      if (contingencia.bloqueado) return aplicarRespostaLimite(res, mensagem, contingencia.expiraEm)
    }
    return next()
  }
}

const limitarAutenticacao = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  limite: 10,
  mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  obterChaves: chavesAutenticacao,
})

const limitarRecuperacao = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  limite: 5,
  mensagem: 'Muitas solicitações de recuperação. Tente novamente mais tarde.',
  obterChaves: chavesAutenticacao,
})

const limitarRenovacaoSessao = criarLimitador({
  janelaMs: 60 * 1000,
  limite: 60,
  mensagem: 'Muitas tentativas de renovar a sessão. Aguarde um minuto e tente novamente.',
  obterChave: (req) => `refresh:${req.ip}`,
})

const limitarWhatsAppTeste = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  limite: 5,
  mensagem: 'Limite de mensagens de teste atingido. Aguarde alguns minutos.',
  obterChave: (req) => `${req.userId}:${req.ip}:${req.baseUrl}${req.path}`,
})

module.exports = {
  criarLimitador,
  hashChave,
  identidadeRequisicao,
  limitarAutenticacao,
  limitarRecuperacao,
  limitarRenovacaoSessao,
  limitarWhatsAppTeste,
}

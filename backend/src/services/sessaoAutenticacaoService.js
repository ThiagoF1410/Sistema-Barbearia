const crypto = require('crypto')
const pool = require('../config/db')
const { signToken } = require('../utils/authUtils')

const COOKIE_REFRESH = 'orn_refresh'
const MINUTO_MS = 60 * 1000
const HORA_MS = 60 * MINUTO_MS
const DIA_MS = 24 * HORA_MS

const POLITICAS_SESSAO = Object.freeze({
  cliente: Object.freeze({ duracaoMaximaMs: 7 * DIA_MS, inatividadeMs: null }),
  profissional: Object.freeze({ duracaoMaximaMs: 12 * HORA_MS, inatividadeMs: 2 * HORA_MS }),
  admin: Object.freeze({ duracaoMaximaMs: 8 * HORA_MS, inatividadeMs: 2 * HORA_MS }),
})

function politicaSessao(perfil) {
  const politica = POLITICAS_SESSAO[perfil]
  if (!politica) throw new Error('Perfil inválido para criação de sessão.')
  return politica
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function gerarRefreshToken() {
  return crypto.randomBytes(32).toString('hex')
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge,
  }
}

function definirCookie(res, token, maxAge) {
  res.cookie(COOKIE_REFRESH, token, cookieOptions(maxAge))
}

function limparCookie(res) {
  res.clearCookie(COOKIE_REFRESH, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  })
}

function lerCookie(req, nome = COOKIE_REFRESH) {
  const cabecalho = req.headers?.cookie
  if (!cabecalho) return null
  for (const parte of cabecalho.split(';')) {
    const separador = parte.indexOf('=')
    if (separador < 0) continue
    const chave = parte.slice(0, separador).trim()
    if (chave !== nome) continue
    try {
      return decodeURIComponent(parte.slice(separador + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

function dadosPublicosSessao({ perfil, criadaEm, ultimaAtividadeEm, expiraEm }) {
  const politica = politicaSessao(perfil)
  const limiteInatividade = politica.inatividadeMs
    ? new Date(new Date(ultimaAtividadeEm).getTime() + politica.inatividadeMs)
    : null
  const limiteAbsoluto = new Date(expiraEm)
  return {
    perfil,
    criadaEm: new Date(criadaEm).toISOString(),
    expiraEm: limiteAbsoluto.toISOString(),
    inatividadeExpiraEm: limiteInatividade
      ? new Date(Math.min(limiteInatividade.getTime(), limiteAbsoluto.getTime())).toISOString()
      : null,
    inatividadeSegundos: politica.inatividadeMs ? politica.inatividadeMs / 1000 : null,
  }
}

function respostaAutenticacao(usuario, perfil, registro, refreshToken, res) {
  const restante = Math.max(0, new Date(registro.expira_em).getTime() - Date.now())
  definirCookie(res, refreshToken, restante)
  return {
    token: signToken({
      id: Number(usuario.idusuario),
      email: usuario.email,
      role: perfil,
      tokenVersion: Number(usuario.token_version),
      sid: Number(registro.idsessao),
    }),
    user: {
      id: Number(usuario.idusuario),
      name: usuario.nome,
      email: usuario.email,
      role: perfil,
    },
    session: dadosPublicosSessao({
      perfil,
      criadaEm: registro.criada_em,
      ultimaAtividadeEm: registro.ultima_atividade_em,
      expiraEm: registro.expira_em,
    }),
  }
}

async function criarSessao(client, usuario, perfil) {
  const politica = politicaSessao(perfil)
  const refreshToken = gerarRefreshToken()
  const expiraEm = new Date(Date.now() + politica.duracaoMaximaMs)
  const result = await client.query(
    `INSERT INTO public.sessao_autenticacao
      (usuario_idusuario, perfil, refresh_token_hash, expira_em)
     VALUES ($1, $2, $3, $4)
     RETURNING idsessao, criada_em, ultima_atividade_em, expira_em`,
    [usuario.idusuario, perfil, hashToken(refreshToken), expiraEm]
  )
  return { registro: result.rows[0], refreshToken, perfil, usuario }
}

function concluirCriacaoSessao(sessao, res) {
  return respostaAutenticacao(
    sessao.usuario,
    sessao.perfil,
    sessao.registro,
    sessao.refreshToken,
    res
  )
}

function sessaoAindaValida(registro, agora = Date.now()) {
  const politica = politicaSessao(registro.perfil)
  if (registro.revogada_em || new Date(registro.expira_em).getTime() <= agora) return false
  if (!politica.inatividadeMs) return true
  return new Date(registro.ultima_atividade_em).getTime() + politica.inatividadeMs > agora
}

async function renovarSessao(req, res) {
  const tokenAtual = lerCookie(req)
  if (!tokenAtual) return null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `SELECT s.idsessao, s.perfil, s.criada_em, s.ultima_atividade_em,
              s.expira_em, s.revogada_em,
              u.idusuario, u.nome, u.email, u.token_version,
              CASE
                WHEN a.idadministrador IS NOT NULL THEN 'admin'
                WHEN p.idprofissional IS NOT NULL AND p.ativo = TRUE THEN 'profissional'
                WHEN c.idcliente IS NOT NULL THEN 'cliente'
                ELSE NULL
              END AS perfil_atual
       FROM public.sessao_autenticacao s
       JOIN public.usuario u ON u.idusuario = s.usuario_idusuario
       LEFT JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
       LEFT JOIN public.profissional p ON p.usuario_idusuario = u.idusuario
       LEFT JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
       WHERE s.refresh_token_hash = $1
       FOR UPDATE OF s`,
      [hashToken(tokenAtual)]
    )
    const registro = result.rows[0]
    if (!registro || registro.perfil !== registro.perfil_atual || !sessaoAindaValida(registro)) {
      if (registro && !registro.revogada_em) {
        await client.query(
          'UPDATE public.sessao_autenticacao SET revogada_em = NOW() WHERE idsessao = $1',
          [registro.idsessao]
        )
      }
      await client.query('COMMIT')
      limparCookie(res)
      return null
    }

    const novoRefreshToken = gerarRefreshToken()
    const atualizada = await client.query(
      `UPDATE public.sessao_autenticacao
       SET refresh_token_hash = $1, ultima_atividade_em = NOW()
       WHERE idsessao = $2
       RETURNING idsessao, criada_em, ultima_atividade_em, expira_em`,
      [hashToken(novoRefreshToken), registro.idsessao]
    )
    await client.query('COMMIT')
    return respostaAutenticacao(
      registro,
      registro.perfil,
      atualizada.rows[0],
      novoRefreshToken,
      res
    )
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function encerrarSessao(req, res) {
  const token = lerCookie(req)
  if (token) {
    await pool.query(
      `UPDATE public.sessao_autenticacao
       SET revogada_em = COALESCE(revogada_em, NOW())
       WHERE refresh_token_hash = $1`,
      [hashToken(token)]
    )
  }
  limparCookie(res)
}

async function revogarSessoesUsuario(client, usuarioId) {
  await client.query(
    `UPDATE public.sessao_autenticacao
     SET revogada_em = COALESCE(revogada_em, NOW())
     WHERE usuario_idusuario = $1 AND revogada_em IS NULL`,
    [usuarioId]
  )
}

module.exports = {
  COOKIE_REFRESH,
  POLITICAS_SESSAO,
  politicaSessao,
  hashToken,
  lerCookie,
  dadosPublicosSessao,
  criarSessao,
  concluirCriacaoSessao,
  sessaoAindaValida,
  renovarSessao,
  encerrarSessao,
  revogarSessoesUsuario,
}

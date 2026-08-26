const tentativas = new Map()

const limpeza = setInterval(() => {
  const agora = Date.now()
  for (const [chave, registro] of tentativas) {
    if (registro.expiraEm <= agora) tentativas.delete(chave)
  }
}, 10 * 60 * 1000)
limpeza.unref()

function criarLimitador({ janelaMs, limite, mensagem, obterChave }) {
  return (req, res, next) => {
    const agora = Date.now()
    const chave = obterChave
      ? String(obterChave(req))
      : `${req.ip}:${req.baseUrl}${req.path}`
    const registro = tentativas.get(chave)

    if (!registro || registro.expiraEm <= agora) {
      tentativas.set(chave, { quantidade: 1, expiraEm: agora + janelaMs })
      return next()
    }

    if (registro.quantidade >= limite) {
      const segundos = Math.max(1, Math.ceil((registro.expiraEm - agora) / 1000))
      res.set('Retry-After', String(segundos))
      return res.status(429).json({ message: mensagem })
    }

    registro.quantidade += 1
    return next()
  }
}

const limitarAutenticacao = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  limite: 10,
  mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
})

const limitarRecuperacao = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  limite: 5,
  mensagem: 'Muitas solicitações de recuperação. Tente novamente mais tarde.',
})

const limitarWhatsAppTeste = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  limite: 5,
  mensagem: 'Limite de mensagens de teste atingido. Aguarde alguns minutos.',
  obterChave: (req) => `${req.userId}:${req.ip}:${req.baseUrl}${req.path}`,
})

module.exports = {
  criarLimitador,
  limitarAutenticacao,
  limitarRecuperacao,
  limitarWhatsAppTeste,
}

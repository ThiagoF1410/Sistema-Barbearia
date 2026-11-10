function origemDesenvolvimentoValida(valor) {
  try {
    const url = new URL(valor)
    const hostPrivado = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname)

    return url.protocol === 'http:' && hostPrivado ? url.origin : null
  } catch {
    return null
  }
}

function urlFrontend(req) {
  const configurada = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
  const origem = req.body?.origemRetorno || req.get?.('origin')

  if (origem === configurada) return configurada
  if (process.env.NODE_ENV !== 'production') {
    return origemDesenvolvimentoValida(origem) || configurada
  }
  return configurada
}

module.exports = { origemDesenvolvimentoValida, urlFrontend }

function criarHttpsMiddleware(isProduction) {
  return function exigirHttps(req, res, next) {
    if (!isProduction || req.secure) return next()

    return res.status(426).json({
      message: 'Esta API aceita somente conexões HTTPS em produção.',
    })
  }
}

function criarCabecalhosSeguros(isProduction) {
  return function cabecalhosSeguros(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')

    if (isProduction && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
  }
}

module.exports = { criarHttpsMiddleware, criarCabecalhosSeguros }

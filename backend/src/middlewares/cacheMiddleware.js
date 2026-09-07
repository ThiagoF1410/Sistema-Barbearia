function cachePublico(segundos = 60) {
  return function definirCachePublico(req, res, next) {
    res.setHeader('Cache-Control', `public, max-age=${segundos}, stale-while-revalidate=${segundos * 2}`)
    next()
  }
}

module.exports = { cachePublico }

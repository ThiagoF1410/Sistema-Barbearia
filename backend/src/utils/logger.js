function textoSeguro(valor, limite = 160) {
  return String(valor ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, limite)
}

function codigoSeguro(erro) {
  const codigo = textoSeguro(erro?.code || erro?.name || 'ERRO_INTERNO', 64).toUpperCase()
  return /^[A-Z0-9_-]+$/.test(codigo) ? codigo : 'ERRO_INTERNO'
}

function resumirErro(erro, { incluirMensagem = process.env.NODE_ENV !== 'production' } = {}) {
  const resumo = {
    tipo: textoSeguro(erro?.name || 'Error', 64) || 'Error',
    codigo: codigoSeguro(erro),
  }

  if (incluirMensagem && erro?.message) {
    resumo.mensagem = textoSeguro(erro.message)
  }

  return resumo
}

function registrarErro(contexto, erro) {
  console.error(textoSeguro(contexto, 120) || 'Erro interno:', resumirErro(erro))
}

module.exports = { textoSeguro, resumirErro, registrarErro }


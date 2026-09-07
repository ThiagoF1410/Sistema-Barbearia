export function prepararAbaPagamento() {
  const aba = window.open('', '_blank')
  if (aba) {
    aba.document.title = 'Abrindo pagamento seguro...'
    aba.document.body.style.cssText = 'margin:0;min-height:100vh;display:grid;place-items:center;background:#101010;color:#f5c518;font-family:Arial,sans-serif'
    aba.document.body.textContent = 'Preparando o pagamento seguro...'
    aba.opener = null
  }
  return aba
}

export function abrirCheckoutEmNovaAba(checkoutUrl, abaPreparada = null) {
  const aba = abaPreparada && !abaPreparada.closed
    ? abaPreparada
    : window.open('', '_blank')

  if (aba) {
    aba.location.replace(checkoutUrl)
    aba.focus()
    return true
  }

  window.location.assign(checkoutUrl)
  return false
}

export function fecharAbaPagamento(aba) {
  if (aba && !aba.closed) aba.close()
}

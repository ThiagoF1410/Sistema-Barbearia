import api from './api'

export async function consultarContatoWhatsApp() {
  const resposta = await api.get('/whatsapp/contato')
  return resposta.data
}

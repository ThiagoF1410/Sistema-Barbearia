import api from './api'

export async function listarProfissionais() {
  const res = await api.get('/profissionais')
  return res.data
}

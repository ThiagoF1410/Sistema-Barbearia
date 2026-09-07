import api from './api'

export async function listarAgenda() {
  const res = await api.get('/agenda')
  return res.data
}

export async function criarData(data) {
  const res = await api.post('/agenda', data)
  return res.data
}

export async function alterarDisponibilidade(id, disponivel) {
  const res = await api.patch(`/agenda/${id}/disponibilidade`, { disponivel })
  return res.data
}

export async function deletarData(id) {
  const res = await api.delete(`/agenda/${id}`)
  return res.data
}

export async function listarHorariosFuncionamento() {
  const res = await api.get('/agenda/horarios')
  return res.data
}

export async function salvarHorariosFuncionamento(horarios) {
  const res = await api.put('/agenda/horarios', { horarios })
  return res.data
}

export async function obterCalendario(ano, mes, servicoId, profissionalId) {
  const params = { ano, mes }
  if (servicoId && profissionalId) Object.assign(params, { servicoId, profissionalId })
  const res = await api.get('/agenda/calendario', { params })
  return res.data
}

export async function obterHorariosDisponiveis(data, servicoId, profissionalId) {
  const res = await api.get('/agenda/horarios-disponiveis', { params: { data, servicoId, profissionalId } })
  return res.data
}

export async function listarFeriados(ano) {
  const res = await api.get('/agenda/feriados', { params: { ano } })
  return res.data
}

export async function importarFeriados(ano) {
  const res = await api.post(`/agenda/feriados/importar/${ano}`)
  return res.data
}

export async function atualizarFeriado(id, dados) {
  const res = await api.patch(`/agenda/feriados/${id}`, dados)
  return res.data
}

export async function listarHorariosProfissional(profissionalId) {
  const res = await api.get(`/agenda/profissionais/${profissionalId}/horarios`)
  return res.data
}

export async function salvarHorariosProfissional(profissionalId, horarios) {
  const res = await api.put(`/agenda/profissionais/${profissionalId}/horarios`, { horarios })
  return res.data
}

export async function listarAusenciasProfissional(profissionalId) {
  const res = await api.get(`/agenda/profissionais/${profissionalId}/ausencias`)
  return res.data
}

export async function criarAusenciaProfissional(profissionalId, dados) {
  const res = await api.post(`/agenda/profissionais/${profissionalId}/ausencias`, dados)
  return res.data
}

export async function deletarAusenciaProfissional(profissionalId, ausenciaId) {
  const res = await api.delete(`/agenda/profissionais/${profissionalId}/ausencias/${ausenciaId}`)
  return res.data
}

export async function listarMeusHorariosProfissional() {
  const res = await api.get('/agenda/profissional/horarios')
  return res.data
}

export async function listarMinhasAusenciasProfissional() {
  const res = await api.get('/agenda/profissional/ausencias')
  return res.data
}

export async function listarMinhasSolicitacoesAusencia() {
  const res = await api.get('/agenda/profissional/solicitacoes-ausencia')
  return res.data
}

export async function criarMinhaSolicitacaoAusencia(dados) {
  const res = await api.post('/agenda/profissional/solicitacoes-ausencia', dados)
  return res.data
}

export async function cancelarMinhaSolicitacaoAusencia(solicitacaoId) {
  const res = await api.delete(`/agenda/profissional/solicitacoes-ausencia/${solicitacaoId}`)
  return res.data
}

export async function listarSolicitacoesAusenciaAdmin(params = {}) {
  const res = await api.get('/agenda/solicitacoes-ausencia', { params })
  return res.data
}

export async function analisarSolicitacaoAusencia(solicitacaoId, decisao, resposta = '') {
  const res = await api.patch(`/agenda/solicitacoes-ausencia/${solicitacaoId}`, { decisao, resposta })
  return res.data
}

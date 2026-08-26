const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const MODOS_FERIADO = ['fechado', 'horario_normal', 'horario_especial', 'ignorar']

function idValido(id) {
  return /^\d+$/.test(String(id)) && Number(id) > 0
}

function dataIsoValida(valor) {
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) return false
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano
    && data.getUTCMonth() === mes - 1
    && data.getUTCDate() === dia
}

function horaParaMinutos(hora) {
  const [horas, minutos] = hora.split(':').map(Number)
  return horas * 60 + minutos
}

function minutosParaHora(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function atendimentoCabeNoExpediente(inicio, duracao, regra) {
  const horario = String(inicio || '').slice(0, 5)
  const minutosDuracao = Number(duracao)
  const abertura = String(regra?.hora_abertura || '').slice(0, 5)
  const fechamento = String(regra?.hora_fechamento || '').slice(0, 5)

  if (!regra?.ativo || !HORA.test(horario) || !HORA.test(abertura) || !HORA.test(fechamento)
      || !Number.isFinite(minutosDuracao) || minutosDuracao <= 0) {
    return false
  }

  const minutosInicio = horaParaMinutos(horario)
  const minutosFim = minutosInicio + minutosDuracao
  if (minutosInicio < horaParaMinutos(abertura) || minutosFim > horaParaMinutos(fechamento)) {
    return false
  }

  if (!regra.intervalo_ativo) return true

  const inicioIntervalo = String(regra.hora_inicio_intervalo || '').slice(0, 5)
  const fimIntervalo = String(regra.hora_fim_intervalo || '').slice(0, 5)
  if (!HORA.test(inicioIntervalo) || !HORA.test(fimIntervalo)) return false

  return minutosInicio >= horaParaMinutos(fimIntervalo)
    || minutosFim <= horaParaMinutos(inicioIntervalo)
}

module.exports = {
  DATA_ISO,
  HORA,
  MODOS_FERIADO,
  idValido,
  dataIsoValida,
  horaParaMinutos,
  minutosParaHora,
  atendimentoCabeNoExpediente,
}

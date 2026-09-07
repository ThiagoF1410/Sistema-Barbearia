export const NOMES_DIAS = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

export const SECOES_AGENDA = [
  { id: 'horarios', titulo: 'Horários e intervalos', resumo: 'Funcionamento semanal', icon: 'clock' },
  { id: 'profissionais', titulo: 'Escala da equipe', resumo: 'Expediente, folgas e férias', icon: 'professional' },
  { id: 'feriados', titulo: 'Feriados', resumo: 'Regras e importação', icon: 'holiday' },
  { id: 'datas', titulo: 'Datas especiais', resumo: 'Bloqueios e liberações', icon: 'calendar' },
]

export function dataLocal(valor) {
  const iso = String(valor || '').slice(0, 10)
  const data = new Date(`${iso}T12:00:00`)
  return Number.isNaN(data.getTime()) ? null : data
}

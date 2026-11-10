const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const {
  PASSO_GRADE_MINUTOS,
  dataIsoValida,
  idValido,
  horaParaMinutos,
  minutosParaHora,
} = require('../../utils/agendaUtils')

async function horariosDisponiveis(req, res) {
  const { data, servicoId, profissionalId } = req.query
  if (!dataIsoValida(data) || !idValido(servicoId) || !idValido(profissionalId)) {
    return res.status(400).json({ message: 'Informe uma data e um serviço válidos.' })
  }

  try {
    const [servicoResult, profissionalResult, horarioResult, agendaResult, feriadoResult, ausenciaResult, ocupadosResult, relogioResult] = await Promise.all([
      pool.query(
        `SELECT idservico, nome, duracao, preco
         FROM public.servico
         WHERE idservico = $1 AND tipo = 'servico'`,
        [servicoId]
      ),
      pool.query('SELECT idprofissional FROM public.profissional WHERE idprofissional = $1 AND ativo = TRUE', [profissionalId]),
      pool.query(
        `SELECT ativo,
                TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento,
                intervalo_ativo,
                TO_CHAR(hora_inicio_intervalo, 'HH24:MI') AS hora_inicio_intervalo,
                TO_CHAR(hora_fim_intervalo, 'HH24:MI') AS hora_fim_intervalo
         FROM (
           SELECT 0 AS prioridade, hp.ativo, hp.hora_abertura, hp.hora_fechamento,
                  hp.intervalo_ativo, hp.hora_inicio_intervalo, hp.hora_fim_intervalo
           FROM public.horario_profissional hp
           WHERE hp.profissional_idprofissional = $2
             AND hp.dia_semana = EXTRACT(DOW FROM $1::date)::INTEGER
           UNION ALL
           SELECT 1, hf.ativo, hf.hora_abertura, hf.hora_fechamento,
                  hf.intervalo_ativo, hf.hora_inicio_intervalo, hf.hora_fim_intervalo
           FROM public.horario_funcionamento hf
           WHERE hf.dia_semana = EXTRACT(DOW FROM $1::date)::INTEGER
         ) AS regras
         ORDER BY prioridade
         LIMIT 1`,
        [data, profissionalId]
      ),
      pool.query('SELECT disponivel FROM public.agenda WHERE data = $1::date', [data]),
      pool.query(
        `SELECT nome, modo_funcionamento,
                TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento
         FROM public.feriado
         WHERE data = $1::date`,
        [data]
      ),
      pool.query(
        `SELECT tipo, descricao
         FROM public.disponibilidade
         WHERE profissional_idprofissional = $1
           AND $2::date BETWEEN datainicio AND datafim
         ORDER BY datainicio DESC, iddisponibilidade DESC
         LIMIT 1`,
        [profissionalId, data]
      ),
      pool.query(
        `SELECT TO_CHAR(a.horario, 'HH24:MI') AS horario,
                COALESCE(a.duracao_snapshot, s.duracao) AS duracao
         FROM public.agendamento a
         JOIN public.servico s ON s.idservico = a.servico_idservico
         WHERE a.profissional_idprofissional = $1 AND a.dataagendamento = $2::date
           AND a.statusagendamento <> 'CANCELADO'`,
        [profissionalId, data]
      ),
      pool.query(
        `SELECT TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS hoje,
                EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::INTEGER * 60
                  + EXTRACT(MINUTE FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS minutos_agora`
      ),
    ])

    if (servicoResult.rows.length === 0) return res.status(404).json({ message: 'Serviço não encontrado.' })

    if (profissionalResult.rows.length === 0) return res.status(404).json({ message: 'Profissional não encontrado ou inativo.' })
    const servico = servicoResult.rows[0]
    const duracao = Number(servico.duracao)
    const horarioSemanal = horarioResult.rows[0]
    const excecao = agendaResult.rows[0]
    const feriado = feriadoResult.rows[0]
    const ausencia = ausenciaResult.rows[0]
    const hoje = relogioResult.rows[0].hoje

    if (data < hoje) return res.status(200).json({ data, servico, horarios: [], motivo: 'Data passada.' })
    if (excecao?.disponivel === false) return res.status(200).json({ data, servico, horarios: [], motivo: 'Data bloqueada pelo administrador.' })
    if (ausencia) {
      return res.status(200).json({
        data,
        servico,
        horarios: [],
        motivo: ausencia.descricao || `Profissional indisponível: ${ausencia.tipo.toLowerCase()}.`,
      })
    }

    let abertura = horarioSemanal?.hora_abertura
    let fechamento = horarioSemanal?.hora_fechamento
    let aberto = Boolean(horarioSemanal?.ativo)

    if (feriado?.modo_funcionamento === 'fechado') aberto = false
    if (feriado?.modo_funcionamento === 'horario_especial') {
      aberto = Boolean(horarioSemanal?.ativo)
      abertura = feriado.hora_abertura
      fechamento = feriado.hora_fechamento
    }
    if (!aberto || !abertura || !fechamento) {
      return res.status(200).json({ data, servico, horarios: [], motivo: feriado?.nome || 'Barbearia fechada nesta data.' })
    }

    const horarios = []
    const inicio = horaParaMinutos(abertura)
    const fim = horaParaMinutos(fechamento)
    const minutosAgora = Number(relogioResult.rows[0].minutos_agora)
    const intervalosOcupados = ocupadosResult.rows.map((item) => {
      const inicioOcupado = horaParaMinutos(item.horario)
      return { inicio: inicioOcupado, fim: inicioOcupado + Number(item.duracao) }
    })
    const inicioIntervalo = horarioSemanal?.intervalo_ativo
      ? horaParaMinutos(horarioSemanal.hora_inicio_intervalo)
      : null
    const fimIntervalo = horarioSemanal?.intervalo_ativo
      ? horaParaMinutos(horarioSemanal.hora_fim_intervalo)
      : null

    for (let horario = inicio; horario + duracao <= fim; horario += PASSO_GRADE_MINUTOS) {
      if (data === hoje && horario <= minutosAgora) continue
      const fimAtendimento = horario + duracao
      if (inicioIntervalo !== null && horario < fimIntervalo && fimAtendimento > inicioIntervalo) continue
      const sobrepoeAgendamento = intervalosOcupados.some((ocupado) =>
        horario < ocupado.fim && fimAtendimento > ocupado.inicio
      )
      if (sobrepoeAgendamento) continue
      horarios.push({
        inicio: minutosParaHora(horario),
        fim: minutosParaHora(fimAtendimento),
      })
    }

    return res.status(200).json({
      data,
      servico: {
        idservico: servico.idservico,
        nome: servico.nome,
        duracao,
        preco: servico.preco,
      },
      expediente: { abertura, fechamento },
      intervalo: inicioIntervalo === null ? null : {
        inicio: minutosParaHora(inicioIntervalo),
        fim: minutosParaHora(fimIntervalo),
      },
      horarios,
      motivo: horarios.length ? null : 'Não há horários compatíveis com a duração deste serviço.',
    })
  } catch (err) {
    registrarErro('Erro ao calcular horários disponíveis:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { horariosDisponiveis }

const pool = require('../../config/db')
const {
  PASSO_GRADE_MINUTOS,
  dataIsoValida,
  idValido,
  horaParaMinutos,
  minutosParaHora,
} = require('../../utils/agendaUtils')

async function calendarioMensal(req, res) {
  const ano = Number(req.query.ano)
  const mes = Number(req.query.mes)
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ message: 'Informe ano e mês válidos.' })
  }
  const { servicoId, profissionalId } = req.query
  const filtroIndividual = servicoId !== undefined || profissionalId !== undefined
  if (filtroIndividual && (!idValido(servicoId) || !idValido(profissionalId))) {
    return res.status(400).json({ message: 'Informe serviço e profissional válidos para consultar a disponibilidade individual.' })
  }

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  try {
    const [diasResult, horariosResult, agendaResult, feriadosResult, ausenciasResult,
      profissionalResult, servicoResult, ocupadosResult, relogioResult] = await Promise.all([
      pool.query(
        `SELECT TO_CHAR(dia, 'YYYY-MM-DD') AS data,
                EXTRACT(DOW FROM dia)::INTEGER AS dia_semana
         FROM generate_series(
           $1::date,
           ($1::date + INTERVAL '1 month - 1 day')::date,
           INTERVAL '1 day'
         ) AS dia`,
        [inicio]
      ),
      filtroIndividual
        ? pool.query(
          `SELECT dias.dia_semana,
                  COALESCE(hp.ativo, hf.ativo, FALSE) AS ativo,
                  COALESCE(hf.ativo, FALSE) AS ativo_global,
                  TO_CHAR(COALESCE(hp.hora_abertura, hf.hora_abertura), 'HH24:MI') AS hora_abertura,
                  TO_CHAR(COALESCE(hp.hora_fechamento, hf.hora_fechamento), 'HH24:MI') AS hora_fechamento,
                  COALESCE(hp.intervalo_ativo, hf.intervalo_ativo, FALSE) AS intervalo_ativo,
                  TO_CHAR(COALESCE(hp.hora_inicio_intervalo, hf.hora_inicio_intervalo), 'HH24:MI') AS hora_inicio_intervalo,
                  TO_CHAR(COALESCE(hp.hora_fim_intervalo, hf.hora_fim_intervalo), 'HH24:MI') AS hora_fim_intervalo
           FROM generate_series(0, 6) AS dias(dia_semana)
           LEFT JOIN public.horario_profissional hp
             ON hp.profissional_idprofissional = $1
            AND hp.dia_semana = dias.dia_semana
           LEFT JOIN public.horario_funcionamento hf
             ON hf.dia_semana = dias.dia_semana`,
          [profissionalId]
        )
        : pool.query(
          `SELECT dia_semana, ativo,
                  TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
                  TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento,
                  intervalo_ativo,
                  TO_CHAR(hora_inicio_intervalo, 'HH24:MI') AS hora_inicio_intervalo,
                  TO_CHAR(hora_fim_intervalo, 'HH24:MI') AS hora_fim_intervalo
           FROM public.horario_funcionamento`
        ),
      pool.query(
        `SELECT TO_CHAR(data, 'YYYY-MM-DD') AS data, disponivel
         FROM public.agenda
         WHERE data >= $1::date AND data < ($1::date + INTERVAL '1 month')`,
        [inicio]
      ),
      pool.query(
        `SELECT idferiado, TO_CHAR(data, 'YYYY-MM-DD') AS data, nome, modo_funcionamento,
                TO_CHAR(hora_abertura, 'HH24:MI') AS hora_abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS hora_fechamento
         FROM public.feriado
         WHERE data >= $1::date AND data < ($1::date + INTERVAL '1 month')`,
        [inicio]
      ),
      filtroIndividual
        ? pool.query(
          `SELECT TO_CHAR(datainicio, 'YYYY-MM-DD') AS datainicio,
                  TO_CHAR(datafim, 'YYYY-MM-DD') AS datafim, tipo, descricao
           FROM public.disponibilidade
           WHERE profissional_idprofissional = $1
             AND datainicio < ($2::date + INTERVAL '1 month')
             AND datafim >= $2::date`,
          [profissionalId, inicio]
        )
        : Promise.resolve({ rows: [] }),
      filtroIndividual
        ? pool.query(
          `SELECT p.idprofissional, u.nome
           FROM public.profissional p
           JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
           WHERE p.idprofissional = $1 AND p.ativo = TRUE`,
          [profissionalId]
        )
        : Promise.resolve({ rows: [] }),
      filtroIndividual
        ? pool.query(
          `SELECT idservico, duracao
           FROM public.servico
           WHERE idservico = $1 AND tipo = 'servico'`,
          [servicoId]
        )
        : Promise.resolve({ rows: [] }),
      filtroIndividual
        ? pool.query(
          `SELECT TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
                  TO_CHAR(a.horario, 'HH24:MI') AS horario,
                  COALESCE(a.duracao_snapshot, s.duracao) AS duracao
           FROM public.agendamento a
           JOIN public.servico s ON s.idservico = a.servico_idservico
           WHERE a.profissional_idprofissional = $1
             AND a.dataagendamento >= $2::date
             AND a.dataagendamento < ($2::date + INTERVAL '1 month')
             AND a.statusagendamento <> 'CANCELADO'`,
          [profissionalId, inicio]
        )
        : Promise.resolve({ rows: [] }),
      pool.query(
        `SELECT TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS hoje,
                EXTRACT(HOUR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::INTEGER * 60
                  + EXTRACT(MINUTE FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS minutos_agora`
      ),
    ])

    if (filtroIndividual && !servicoResult.rows.length) {
      return res.status(404).json({ message: 'Serviço não encontrado.' })
    }
    if (filtroIndividual && !profissionalResult.rows.length) {
      return res.status(404).json({ message: 'Profissional não encontrado ou inativo.' })
    }

    const horarios = new Map(horariosResult.rows.map((item) => [item.dia_semana, item]))
    const agenda = new Map(agendaResult.rows.map((item) => [item.data, item]))
    const feriados = new Map(feriadosResult.rows.map((item) => [item.data, item]))
    const hoje = relogioResult.rows[0].hoje
    const minutosAgora = Number(relogioResult.rows[0].minutos_agora)
    const duracao = filtroIndividual ? Number(servicoResult.rows[0].duracao) : null
    const nomeProfissional = filtroIndividual ? profissionalResult.rows[0]?.nome : null
    const ocupadosPorData = new Map()
    for (const item of ocupadosResult.rows) {
      const ocupados = ocupadosPorData.get(item.data) || []
      const inicioOcupado = horaParaMinutos(item.horario)
      ocupados.push({ inicio: inicioOcupado, fim: inicioOcupado + Number(item.duracao) })
      ocupadosPorData.set(item.data, ocupados)
    }

    const dias = diasResult.rows.map((dia) => {
      const horario = horarios.get(dia.dia_semana)
      const excecao = agenda.get(dia.data)
      const feriado = feriados.get(dia.data)
      const ausencia = ausenciasResult.rows.find((item) => dia.data >= item.datainicio && dia.data <= item.datafim)
      let disponivel = Boolean(horario?.ativo) && dia.data >= hoje
      let motivo = disponivel
        ? 'Disponível'
        : dia.data < hoje
          ? 'Data passada'
          : filtroIndividual && horario?.ativo_global
            ? `${nomeProfissional || 'O profissional selecionado'} não atende neste dia`
            : 'Barbearia fechada neste dia'

      if (feriado) {
        if (feriado.modo_funcionamento === 'fechado') {
          disponivel = false
          motivo = feriado.nome
        } else if (feriado.modo_funcionamento === 'horario_especial') {
          disponivel = dia.data >= hoje && (!filtroIndividual || Boolean(horario?.ativo))
          motivo = `Feriado — ${feriado.hora_abertura} às ${feriado.hora_fechamento}`
        } else if (feriado.modo_funcionamento === 'horario_normal' || feriado.modo_funcionamento === 'ignorar') {
          motivo = disponivel ? 'Disponível' : motivo
        }
      }

      if (excecao?.disponivel === false) {
        disponivel = false
        motivo = 'Data bloqueada pelo administrador'
      } else if (excecao?.disponivel === true && dia.data >= hoje && Boolean(horario?.ativo)
          && feriado?.modo_funcionamento !== 'fechado') {
        disponivel = true
        motivo = 'Data liberada pelo administrador'
      }

      if (ausencia) {
        disponivel = false
        motivo = ausencia.descricao || `Profissional indisponível: ${ausencia.tipo.toLowerCase()}`
      }

      if (filtroIndividual && disponivel) {
        const abertura = feriado?.modo_funcionamento === 'horario_especial'
          ? feriado.hora_abertura
          : horario?.hora_abertura
        const fechamento = feriado?.modo_funcionamento === 'horario_especial'
          ? feriado.hora_fechamento
          : horario?.hora_fechamento
        const inicioExpediente = horaParaMinutos(abertura)
        const fimExpediente = horaParaMinutos(fechamento)
        const inicioIntervalo = horario?.intervalo_ativo ? horaParaMinutos(horario.hora_inicio_intervalo) : null
        const fimIntervalo = horario?.intervalo_ativo ? horaParaMinutos(horario.hora_fim_intervalo) : null
        const ocupados = ocupadosPorData.get(dia.data) || []
        let encontrouHorario = false

        for (let hora = inicioExpediente; hora + duracao <= fimExpediente; hora += PASSO_GRADE_MINUTOS) {
          const fimAtendimento = hora + duracao
          if (dia.data === hoje && hora <= minutosAgora) continue
          if (inicioIntervalo !== null && hora < fimIntervalo && fimAtendimento > inicioIntervalo) continue
          if (ocupados.some((item) => hora < item.fim && fimAtendimento > item.inicio)) continue
          encontrouHorario = true
          break
        }
        if (!encontrouHorario) {
          disponivel = false
          motivo = 'Sem horários livres para este profissional'
        }
      }

      return {
        data: dia.data,
        dia_semana: dia.dia_semana,
        disponivel,
        motivo,
        feriado: feriado ? { nome: feriado.nome, modo_funcionamento: feriado.modo_funcionamento } : null,
      }
    })

    return res.status(200).json(dias)
  } catch (err) {
    console.error('Erro ao montar calendário:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

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
    console.error('Erro ao calcular horários disponíveis:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

module.exports = { calendarioMensal, horariosDisponiveis }

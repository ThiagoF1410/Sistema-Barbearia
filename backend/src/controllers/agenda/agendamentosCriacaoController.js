const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { HORA, dataIsoValida, horarioNaGrade, horaParaMinutos, idValido } = require('../../utils/agendaUtils')

async function criar(req, res) {
  const { servicoId, profissionalId, data, horario } = req.body || {}
  if (!idValido(servicoId) || !idValido(profissionalId) || !dataIsoValida(data) || !HORA.test(horario || '')) {
    return res.status(400).json({ message: 'Informe serviço, profissional, data e horário válidos.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtext('agenda_global'), 0)")
    await client.query(
      "SELECT pg_advisory_xact_lock_shared(hashtext('agenda_profissional'), $1::integer)",
      [profissionalId]
    )
    const cliente = await client.query('SELECT idcliente FROM public.cliente WHERE usuario_idusuario = $1', [req.userId])
    if (!cliente.rows.length) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'Somente clientes podem realizar agendamentos.' })
    }

    const [servico, profissional, funcionamento, feriado, excecao, ausencia, relogio] = await Promise.all([
      client.query(
        `SELECT idservico, nome, duracao, preco FROM public.servico
         WHERE idservico = $1 AND tipo = 'servico'`, [servicoId]
      ),
      client.query(
        `SELECT p.idprofissional, u.nome FROM public.profissional p
         JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
         WHERE p.idprofissional = $1 AND p.ativo = TRUE`, [profissionalId]
      ),
      client.query(
        `SELECT ativo, TO_CHAR(hora_abertura, 'HH24:MI') AS abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS fechamento,
                intervalo_ativo,
                TO_CHAR(hora_inicio_intervalo, 'HH24:MI') AS inicio_intervalo,
                TO_CHAR(hora_fim_intervalo, 'HH24:MI') AS fim_intervalo
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
         LIMIT 1`, [data, profissionalId]
      ),
      client.query(
        `SELECT nome, modo_funcionamento,
                TO_CHAR(hora_abertura, 'HH24:MI') AS abertura,
                TO_CHAR(hora_fechamento, 'HH24:MI') AS fechamento
         FROM public.feriado WHERE data = $1::date`, [data]
      ),
      client.query('SELECT disponivel FROM public.agenda WHERE data = $1::date', [data]),
      client.query(
        `SELECT tipo, descricao
         FROM public.disponibilidade
         WHERE profissional_idprofissional = $1
           AND $2::date BETWEEN datainicio AND datafim
         ORDER BY datainicio DESC, iddisponibilidade DESC
         LIMIT 1`,
        [profissionalId, data]
      ),
      client.query(
        `SELECT TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS data,
                TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS horario`
      ),
    ])

    if (!servico.rows.length || !profissional.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Serviço ou profissional não encontrado.' })
    }
    if (data < relogio.rows[0].data || (data === relogio.rows[0].data && horario <= relogio.rows[0].horario)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este horário já passou. Escolha outro.' })
    }
    if (excecao.rows[0]?.disponivel === false) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Esta data está bloqueada pelo administrador.' })
    }
    if (ausencia.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: ausencia.rows[0].descricao || 'O profissional está indisponível nesta data.',
      })
    }

    const regra = funcionamento.rows[0]
    const regraFeriado = feriado.rows[0]
    let aberto = Boolean(regra?.ativo)
    let abertura = regra?.abertura
    let fechamento = regra?.fechamento
    if (regraFeriado?.modo_funcionamento === 'fechado') aberto = false
    if (regraFeriado?.modo_funcionamento === 'horario_especial') {
      aberto = Boolean(regra?.ativo)
      abertura = regraFeriado.abertura
      fechamento = regraFeriado.fechamento
    }
    if (!aberto || !abertura || !fechamento) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'A barbearia está fechada nesta data.' })
    }

    const inicio = horaParaMinutos(horario)
    const duracao = Number(servico.rows[0].duracao)
    const fim = inicio + duracao
    const minutosAbertura = horaParaMinutos(abertura)
    const minutosFechamento = horaParaMinutos(fechamento)
    const alinhado = horarioNaGrade(inicio, minutosAbertura)
    const cruzaIntervalo = Boolean(regra?.intervalo_ativo)
      && inicio < horaParaMinutos(regra.fim_intervalo)
      && fim > horaParaMinutos(regra.inicio_intervalo)
    if (inicio < minutosAbertura || fim > minutosFechamento || !alinhado || cruzaIntervalo) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'O horário selecionado não está mais disponível.' })
    }

    // Serializa reservas do mesmo profissional e dia para evitar que duas
    // requisições simultâneas confirmem intervalos sobrepostos.
    await client.query(
      'SELECT pg_advisory_xact_lock($1::integer, hashtext($2::text))',
      [profissionalId, data]
    )

    const conflito = await client.query(
      `SELECT 1
       FROM public.agendamento a
       JOIN public.servico s ON s.idservico = a.servico_idservico
       WHERE a.profissional_idprofissional = $1
         AND a.dataagendamento = $2::date
         AND a.statusagendamento <> 'CANCELADO'
         AND a.horario < ($3::time + ($4 * INTERVAL '1 minute'))
         AND (a.horario + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute')) > $3::time
       LIMIT 1`,
      [profissionalId, data, horario, duracao]
    )
    if (conflito.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este horário conflita com outro atendimento. Escolha outro.' })
    }

    const agenda = await client.query(
      `INSERT INTO public.agenda (data, disponivel) VALUES ($1::date, TRUE)
       ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data
       RETURNING idagenda, disponivel`, [data]
    )
    if (!agenda.rows[0].disponivel) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Esta data está bloqueada pelo administrador.' })
    }
    const result = await client.query(
      `INSERT INTO public.agendamento
       (agenda_idagenda, cliente_idcliente, profissional_idprofissional, servico_idservico,
        dataagendamento, horario, statusagendamento,
        servico_nome_snapshot, duracao_snapshot, valor_snapshot)
       VALUES ($1, $2, $3, $4, $5::date, $6::time, 'AGENDADO', $7, $8, $9)
       RETURNING idagendamento, TO_CHAR(dataagendamento, 'YYYY-MM-DD') AS data,
                 TO_CHAR(horario, 'HH24:MI') AS horario, statusagendamento`,
      [agenda.rows[0].idagenda, cliente.rows[0].idcliente, profissionalId, servicoId, data, horario,
        servico.rows[0].nome, duracao, servico.rows[0].preco]
    )
    await client.query('COMMIT')
    return res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505' || err.code === '23P01') {
      return res.status(409).json({ message: 'Este horário acabou de ser reservado. Escolha outro.' })
    }
    registrarErro('Erro ao criar agendamento:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = { criar }

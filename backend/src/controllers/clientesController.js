const pool = require('../config/db')
const { emailValido, normalizarEmail } = require('../utils/authUtils')
const { idValido } = require('../utils/agendaUtils')
const { normalizarPaginacao, montarPaginacao } = require('../utils/paginationUtils')

function validarDadosCliente(body = {}) {
  const nome = typeof body.nome === 'string' ? body.nome.trim().replace(/\s+/g, ' ') : ''
  const email = normalizarEmail(body.email)
  const telefone = typeof body.telefone === 'string' ? body.telefone.replace(/\D/g, '') : ''

  if (nome.length < 2 || nome.length > 100) return { erro: 'O nome deve ter entre 2 e 100 caracteres.' }
  if (!emailValido(email) || email.length > 150) return { erro: 'Informe um e-mail válido.' }
  if (!/^\d{10,11}$/.test(telefone)) return { erro: 'Informe um telefone com DDD válido.' }
  return { nome, email, telefone }
}

async function listarGestao(req, res) {
  const paginacao = normalizarPaginacao(req.query)
  if (paginacao.erro) return res.status(400).json({ message: paginacao.erro })
  const busca = String(req.query.busca || '').trim().slice(0, 100)
  const filtro = String(req.query.filtro || 'todos').trim().toLowerCase()
  if (!['todos', 'futuros', 'sem-agenda', 'recorrentes'].includes(filtro)) {
    return res.status(400).json({ message: 'Filtro de clientes invalido.' })
  }

  try {
    if (paginacao.solicitada) {
      const valores = []
      const condicoes = []
      if (busca) {
        valores.push(`%${busca}%`)
        condicoes.push(`(nome ILIKE $${valores.length} OR email ILIKE $${valores.length} OR telefone ILIKE $${valores.length})`)
      }
      if (filtro === 'futuros') condicoes.push('agendamentos_futuros > 0')
      if (filtro === 'sem-agenda') condicoes.push('agendamentos_futuros = 0')
      if (filtro === 'recorrentes') condicoes.push('atendimentos_concluidos >= 2')
      const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
      valores.push(paginacao.limite, paginacao.offset)
      const limitePosicao = valores.length - 1
      const base = `WITH clientes_resumo AS (
        SELECT c.idcliente, c.usuario_idusuario, u.nome, u.email, c.telefone,
               TO_CHAR(c.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS data_cadastro,
               COUNT(a.idagendamento)::integer AS total_agendamentos,
               COUNT(a.idagendamento) FILTER (WHERE a.statusagendamento = 'CONCLUIDO')::integer AS atendimentos_concluidos,
               COUNT(a.idagendamento) FILTER (WHERE a.statusagendamento = 'CANCELADO')::integer AS cancelamentos,
               COUNT(a.idagendamento) FILTER (WHERE a.statusagendamento = 'AGENDADO' AND (a.dataagendamento + a.horario) > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::integer AS agendamentos_futuros,
               TO_CHAR(MAX(a.dataagendamento + a.horario) FILTER (WHERE a.statusagendamento = 'CONCLUIDO'), 'YYYY-MM-DD HH24:MI') AS ultimo_atendimento,
               TO_CHAR(MIN(a.dataagendamento + a.horario) FILTER (WHERE a.statusagendamento = 'AGENDADO' AND (a.dataagendamento + a.horario) > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD HH24:MI') AS proximo_agendamento
        FROM public.cliente c
        JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
        LEFT JOIN public.agendamento a ON a.cliente_idcliente = c.idcliente
        GROUP BY c.idcliente, c.usuario_idusuario, u.nome, u.email, c.telefone, c.criado_em
      )`
      const [lista, total, resumo] = await Promise.all([
        pool.query(`${base} SELECT * FROM clientes_resumo ${where} ORDER BY nome, idcliente LIMIT $${limitePosicao} OFFSET $${limitePosicao + 1}`, valores),
        pool.query(`${base} SELECT COUNT(*)::integer AS total FROM clientes_resumo ${where}`, valores.slice(0, limitePosicao - 1)),
        pool.query(`${base} SELECT COUNT(*)::integer AS total,
          COUNT(*) FILTER (WHERE data_cadastro >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM-DD'))::integer AS novos_mes,
          COUNT(*) FILTER (WHERE agendamentos_futuros > 0)::integer AS com_futuro,
          COUNT(*) FILTER (WHERE atendimentos_concluidos >= 2)::integer AS recorrentes
          FROM clientes_resumo`, []),
      ])
      const quantidade = Number(total.rows[0]?.total || 0)
      return res.status(200).json({
        clientes: lista.rows,
        resumo: resumo.rows[0] || { total: 0, novos_mes: 0, com_futuro: 0, recorrentes: 0 },
        paginacao: montarPaginacao(quantidade, paginacao.pagina, paginacao.limite),
      })
    }
    const result = await pool.query(
      `SELECT c.idcliente, c.usuario_idusuario, u.nome, u.email, c.telefone,
              TO_CHAR(c.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS data_cadastro,
              COUNT(a.idagendamento)::integer AS total_agendamentos,
              COUNT(a.idagendamento) FILTER (
                WHERE a.statusagendamento = 'CONCLUIDO'
              )::integer AS atendimentos_concluidos,
              COUNT(a.idagendamento) FILTER (
                WHERE a.statusagendamento = 'CANCELADO'
              )::integer AS cancelamentos,
              COUNT(a.idagendamento) FILTER (
                WHERE a.statusagendamento = 'AGENDADO'
                  AND (a.dataagendamento + a.horario)
                    > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
              )::integer AS agendamentos_futuros,
              TO_CHAR(
                MAX(a.dataagendamento + a.horario) FILTER (
                  WHERE a.statusagendamento = 'CONCLUIDO'
                ),
                'YYYY-MM-DD HH24:MI'
              ) AS ultimo_atendimento,
              TO_CHAR(
                MIN(a.dataagendamento + a.horario) FILTER (
                  WHERE a.statusagendamento = 'AGENDADO'
                    AND (a.dataagendamento + a.horario)
                      > CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'
                ),
                'YYYY-MM-DD HH24:MI'
              ) AS proximo_agendamento
       FROM public.cliente c
       JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
       LEFT JOIN public.agendamento a ON a.cliente_idcliente = c.idcliente
       GROUP BY c.idcliente, c.usuario_idusuario, u.nome, u.email, c.telefone, c.criado_em
       ORDER BY u.nome, c.idcliente`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar clientes para gestão:', err)
    return res.status(500).json({ message: 'Não foi possível carregar os clientes agora.' })
  }
}

async function atualizar(req, res) {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Cliente inválido.' })
  const dados = validarDadosCliente(req.body)
  if (dados.erro) return res.status(400).json({ message: dados.erro })

  const client = await pool.connect()
  let transacaoAtiva = false
  try {
    await client.query('BEGIN')
    transacaoAtiva = true
    const cliente = await client.query(
      `SELECT usuario_idusuario
       FROM public.cliente
       WHERE idcliente = $1
       FOR UPDATE`,
      [req.params.id]
    )
    if (!cliente.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(404).json({ message: 'Cliente não encontrado.' })
    }

    const duplicado = await client.query(
      `SELECT 1 FROM public.usuario
       WHERE LOWER(BTRIM(email)) = $1 AND idusuario <> $2
       LIMIT 1`,
      [dados.email, cliente.rows[0].usuario_idusuario]
    )
    if (duplicado.rows.length) {
      await client.query('ROLLBACK')
      transacaoAtiva = false
      return res.status(409).json({ message: 'E-mail já cadastrado.' })
    }

    const usuario = await client.query(
      `UPDATE public.usuario
       SET nome = $1, email = $2
       WHERE idusuario = $3
       RETURNING nome, email`,
      [dados.nome, dados.email, cliente.rows[0].usuario_idusuario]
    )
    const contato = await client.query(
      `UPDATE public.cliente
       SET telefone = $1
       WHERE idcliente = $2
       RETURNING idcliente, telefone`,
      [dados.telefone, req.params.id]
    )
    await client.query('COMMIT')
    transacaoAtiva = false
    return res.status(200).json({ ...contato.rows[0], ...usuario.rows[0] })
  } catch (err) {
    if (transacaoAtiva) await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ message: 'E-mail já cadastrado.' })
    console.error('Erro ao atualizar cliente:', err)
    return res.status(500).json({ message: 'Não foi possível atualizar o cliente agora.' })
  } finally {
    client.release()
  }
}

async function listarAgendamentos(req, res) {
  if (!idValido(req.params.id)) return res.status(400).json({ message: 'Cliente inválido.' })
  try {
    const cliente = await pool.query('SELECT 1 FROM public.cliente WHERE idcliente = $1', [req.params.id])
    if (!cliente.rows.length) return res.status(404).json({ message: 'Cliente não encontrado.' })

    const result = await pool.query(
      `SELECT a.idagendamento,
              TO_CHAR(a.dataagendamento, 'YYYY-MM-DD') AS data,
              TO_CHAR(a.horario, 'HH24:MI') AS horario,
              a.statusagendamento,
              COALESCE(a.servico_nome_snapshot, s.nome) AS servico,
              COALESCE(a.duracao_snapshot, s.duracao) AS duracao,
              COALESCE(a.valor_snapshot, s.preco) AS preco,
              up.nome AS profissional,
              pagamento.statuspagamento
       FROM public.agendamento a
       JOIN public.servico s ON s.idservico = a.servico_idservico
       JOIN public.profissional p ON p.idprofissional = a.profissional_idprofissional
       JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
       LEFT JOIN LATERAL (
         SELECT pg.statuspagamento
         FROM public.pagamento pg
         WHERE pg.agendamento_idagendamento = a.idagendamento
         ORDER BY pg.idpagamento DESC
         LIMIT 1
       ) pagamento ON TRUE
       WHERE a.cliente_idcliente = $1
       ORDER BY a.dataagendamento DESC, a.horario DESC, a.idagendamento DESC`,
      [req.params.id]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('Erro ao listar histórico administrativo do cliente:', err)
    return res.status(500).json({ message: 'Não foi possível carregar o histórico do cliente agora.' })
  }
}

module.exports = { listarGestao, atualizar, listarAgendamentos, validarDadosCliente }

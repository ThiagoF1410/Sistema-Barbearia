const { registrarErro } = require('../../utils/logger')
const pool = require('../../config/db')
const { dataIsoValida, idValido } = require('../../utils/agendaUtils')

const TIPOS_SOLICITACAO = new Set(['FOLGA', 'FERIAS'])
const DECISOES = new Set(['APROVAR', 'RECUSAR'])

function validarSolicitacao(body) {
  const { tipo, datainicio, datafim, motivo } = body || {}
  if (!TIPOS_SOLICITACAO.has(tipo) || !dataIsoValida(datainicio)
    || !dataIsoValida(datafim) || datafim < datainicio) {
    return 'Informe um tipo e um período válidos para a solicitação.'
  }
  if (motivo !== undefined && (typeof motivo !== 'string' || motivo.trim().length > 255)) {
    return 'O motivo deve possuir no máximo 255 caracteres.'
  }
  return null
}

async function obterProfissionalAutenticado(conexao, usuarioId) {
  const result = await conexao.query(
    `SELECT p.idprofissional
     FROM public.profissional p
     WHERE p.usuario_idusuario = $1 AND p.ativo = TRUE`,
    [usuarioId]
  )
  return result.rows[0]
}

const CAMPOS_LISTAGEM = `s.idsolicitacao, s.profissional_idprofissional,
  u.nome AS profissional, s.tipo,
  TO_CHAR(s.datainicio, 'YYYY-MM-DD') AS datainicio,
  TO_CHAR(s.datafim, 'YYYY-MM-DD') AS datafim,
  s.motivo, s.status, s.resposta_administrador,
  s.disponibilidade_iddisponibilidade,
  s.criado_em, s.analisado_em`

async function listarMinhasSolicitacoes(req, res) {
  try {
    const profissional = await obterProfissionalAutenticado(pool, req.userId)
    if (!profissional) return res.status(404).json({ message: 'Perfil profissional não encontrado ou inativo.' })

    const result = await pool.query(
      `SELECT ${CAMPOS_LISTAGEM}
       FROM public.solicitacao_ausencia_profissional s
       JOIN public.profissional p ON p.idprofissional = s.profissional_idprofissional
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       WHERE s.profissional_idprofissional = $1
       ORDER BY s.criado_em DESC, s.idsolicitacao DESC`,
      [profissional.idprofissional]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    registrarErro('Erro ao listar solicitações de ausência:', err)
    return res.status(500).json({ message: 'Não foi possível carregar as solicitações.' })
  }
}

async function criarMinhaSolicitacao(req, res) {
  const erroValidacao = validarSolicitacao(req.body)
  if (erroValidacao) return res.status(400).json({ message: erroValidacao })

  const { tipo, datainicio, datafim, motivo } = req.body
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const profissional = await obterProfissionalAutenticado(client, req.userId)
    if (!profissional) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Perfil profissional não encontrado ou inativo.' })
    }

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('solicitacao_ausencia_profissional'), $1::integer)",
      [profissional.idprofissional]
    )

    const hojeResult = await client.query("SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS hoje")
    if (datainicio < hojeResult.rows[0].hoje) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'A solicitação deve começar na data atual ou em uma data futura.' })
    }

    const conflito = await client.query(
      `SELECT idsolicitacao
       FROM public.solicitacao_ausencia_profissional
       WHERE profissional_idprofissional = $1
         AND status IN ('PENDENTE', 'APROVADA')
         AND datainicio <= $3::date
         AND datafim >= $2::date
       LIMIT 1`,
      [profissional.idprofissional, datainicio, datafim]
    )
    if (conflito.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Já existe uma solicitação pendente ou aprovada neste período.' })
    }

    const indisponibilidade = await client.query(
      `SELECT iddisponibilidade
       FROM public.disponibilidade
       WHERE profissional_idprofissional = $1
         AND datainicio <= $3::date
         AND datafim >= $2::date
       LIMIT 1`,
      [profissional.idprofissional, datainicio, datafim]
    )
    if (indisponibilidade.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Este período já está bloqueado pela administração.' })
    }

    const result = await client.query(
      `INSERT INTO public.solicitacao_ausencia_profissional
        (profissional_idprofissional, tipo, datainicio, datafim, motivo)
       VALUES ($1, $2, $3::date, $4::date, $5)
       RETURNING idsolicitacao, profissional_idprofissional, tipo,
         TO_CHAR(datainicio, 'YYYY-MM-DD') AS datainicio,
         TO_CHAR(datafim, 'YYYY-MM-DD') AS datafim, motivo, status, criado_em`,
      [profissional.idprofissional, tipo, datainicio, datafim, motivo?.trim() || null]
    )
    await client.query('COMMIT')
    return res.status(201).json(result.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    registrarErro('Erro ao criar solicitação de ausência:', err)
    return res.status(500).json({ message: 'Não foi possível enviar a solicitação.' })
  } finally {
    client.release()
  }
}

async function cancelarMinhaSolicitacao(req, res) {
  if (!idValido(req.params.solicitacaoId)) {
    return res.status(400).json({ message: 'Solicitação inválida.' })
  }
  try {
    const profissional = await obterProfissionalAutenticado(pool, req.userId)
    if (!profissional) return res.status(404).json({ message: 'Perfil profissional não encontrado ou inativo.' })

    const result = await pool.query(
      `UPDATE public.solicitacao_ausencia_profissional
       SET status = 'CANCELADA'
       WHERE idsolicitacao = $1
         AND profissional_idprofissional = $2
         AND status = 'PENDENTE'
       RETURNING idsolicitacao, status`,
      [req.params.solicitacaoId, profissional.idprofissional]
    )
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Solicitação pendente não encontrada.' })
    }
    return res.status(200).json(result.rows[0])
  } catch (err) {
    registrarErro('Erro ao cancelar solicitação de ausência:', err)
    return res.status(500).json({ message: 'Não foi possível cancelar a solicitação.' })
  }
}

async function listarSolicitacoesAdmin(req, res) {
  const status = String(req.query.status || '').toUpperCase()
  const profissionalId = req.query.profissionalId
  const statusPermitidos = new Set(['', 'PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA'])
  if (!statusPermitidos.has(status)) return res.status(400).json({ message: 'Situação da solicitação inválida.' })
  if (profissionalId && !idValido(profissionalId)) return res.status(400).json({ message: 'Profissional inválido.' })

  try {
    const params = []
    const filtros = []
    if (status) {
      params.push(status)
      filtros.push(`s.status = $${params.length}`)
    }
    if (profissionalId) {
      params.push(profissionalId)
      filtros.push(`s.profissional_idprofissional = $${params.length}`)
    }
    const result = await pool.query(
      `SELECT ${CAMPOS_LISTAGEM}
       FROM public.solicitacao_ausencia_profissional s
       JOIN public.profissional p ON p.idprofissional = s.profissional_idprofissional
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
       ORDER BY CASE WHEN s.status = 'PENDENTE' THEN 0 ELSE 1 END,
                s.criado_em DESC, s.idsolicitacao DESC`,
      params
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    registrarErro('Erro ao listar solicitações para administração:', err)
    return res.status(500).json({ message: 'Não foi possível carregar as solicitações.' })
  }
}

async function analisarSolicitacao(req, res) {
  const solicitacaoId = req.params.solicitacaoId
  const decisao = String(req.body?.decisao || '').toUpperCase()
  const resposta = req.body?.resposta
  if (!idValido(solicitacaoId) || !DECISOES.has(decisao)) {
    return res.status(400).json({ message: 'Informe uma solicitação e uma decisão válidas.' })
  }
  if (resposta !== undefined && (typeof resposta !== 'string' || resposta.trim().length > 255)) {
    return res.status(400).json({ message: 'A resposta deve possuir no máximo 255 caracteres.' })
  }
  if (decisao === 'RECUSAR' && (!resposta || !resposta.trim())) {
    return res.status(400).json({ message: 'Informe o motivo da recusa para o profissional.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const administrador = await client.query(
      'SELECT idadministrador FROM public.administrador WHERE usuario_idusuario = $1',
      [req.userId]
    )
    if (!administrador.rows.length) {
      await client.query('ROLLBACK')
      return res.status(403).json({ message: 'Administrador não identificado.' })
    }

    const solicitacaoResult = await client.query(
      `SELECT *, datafim < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AS expirada
       FROM public.solicitacao_ausencia_profissional
       WHERE idsolicitacao = $1 FOR UPDATE`,
      [solicitacaoId]
    )
    const solicitacao = solicitacaoResult.rows[0]
    if (!solicitacao || solicitacao.status !== 'PENDENTE') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Esta solicitação já foi analisada ou cancelada.' })
    }
    if (decisao === 'APROVAR' && solicitacao.expirada) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Não é possível aprovar uma solicitação cujo período já terminou.' })
    }

    let disponibilidade = null
    if (decisao === 'APROVAR') {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('agenda_profissional'), $1::integer)",
        [solicitacao.profissional_idprofissional]
      )
      const agendamentos = await client.query(
        `SELECT COUNT(*)::INTEGER AS total
         FROM public.agendamento
         WHERE profissional_idprofissional = $1
           AND dataagendamento BETWEEN $2 AND $3
           AND statusagendamento = 'AGENDADO'`,
        [solicitacao.profissional_idprofissional, solicitacao.datainicio, solicitacao.datafim]
      )
      if (agendamentos.rows[0].total > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          message: `A aprovação conflita com ${agendamentos.rows[0].total} agendamento(s) ativo(s) no período.`,
        })
      }

      const ausenciaExistente = await client.query(
        `SELECT iddisponibilidade FROM public.disponibilidade
         WHERE profissional_idprofissional = $1
           AND datainicio <= $3 AND datafim >= $2
         LIMIT 1`,
        [solicitacao.profissional_idprofissional, solicitacao.datainicio, solicitacao.datafim]
      )
      if (ausenciaExistente.rows.length) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'O profissional já possui uma indisponibilidade neste período.' })
      }

      const disponibilidadeResult = await client.query(
        `INSERT INTO public.disponibilidade
          (profissional_idprofissional, tipo, datainicio, datafim, descricao)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING iddisponibilidade, tipo,
           TO_CHAR(datainicio, 'YYYY-MM-DD') AS datainicio,
           TO_CHAR(datafim, 'YYYY-MM-DD') AS datafim, descricao`,
        [solicitacao.profissional_idprofissional, solicitacao.tipo,
          solicitacao.datainicio, solicitacao.datafim, solicitacao.motivo]
      )
      disponibilidade = disponibilidadeResult.rows[0]
    }

    const novoStatus = decisao === 'APROVAR' ? 'APROVADA' : 'RECUSADA'
    const atualizada = await client.query(
      `UPDATE public.solicitacao_ausencia_profissional
       SET status = $2, resposta_administrador = $3,
           administrador_idadministrador = $4,
           disponibilidade_iddisponibilidade = $5,
           analisado_em = CURRENT_TIMESTAMP
       WHERE idsolicitacao = $1
       RETURNING idsolicitacao, status, resposta_administrador, analisado_em`,
      [solicitacaoId, novoStatus, resposta?.trim() || null,
        administrador.rows[0].idadministrador, disponibilidade?.iddisponibilidade || null]
    )
    await client.query('COMMIT')
    return res.status(200).json({ ...atualizada.rows[0], disponibilidade })
  } catch (err) {
    await client.query('ROLLBACK')
    registrarErro('Erro ao analisar solicitação de ausência:', err)
    return res.status(500).json({ message: 'Não foi possível analisar a solicitação.' })
  } finally {
    client.release()
  }
}

module.exports = {
  validarSolicitacao,
  listarMinhasSolicitacoes,
  criarMinhaSolicitacao,
  cancelarMinhaSolicitacao,
  listarSolicitacoesAdmin,
  analisarSolicitacao,
}

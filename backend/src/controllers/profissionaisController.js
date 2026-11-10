const { registrarErro } = require('../utils/logger')
const bcrypt = require('bcryptjs')
const pool = require('../config/db')
const {
  emailValido, normalizarEmail, senhaValida, SENHA_REQUISITOS_MENSAGEM,
} = require('../utils/authUtils')
const { idValido } = require('../utils/agendaUtils')

function validarProfissional(dados, { exigirSenha = false } = {}) {
  const nome = typeof dados?.nome === 'string' ? dados.nome.trim() : ''
  const email = normalizarEmail(dados?.email)
  const especialidade = typeof dados?.especialidade === 'string' ? dados.especialidade.trim() : ''
  const password = typeof dados?.password === 'string' ? dados.password : ''

  if (nome.length < 2 || nome.length > 100) return { erro: 'Informe um nome entre 2 e 100 caracteres.' }
  if (!emailValido(email) || email.length > 150) return { erro: 'Informe um e-mail válido.' }
  if (especialidade.length < 2 || especialidade.length > 100) return { erro: 'Informe uma especialidade entre 2 e 100 caracteres.' }
  if ((exigirSenha || password) && !senhaValida(password)) {
    return { erro: SENHA_REQUISITOS_MENSAGEM }
  }
  return { nome, email, especialidade, password }
}

async function listar(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.idprofissional, u.nome, p.especialidade
       FROM public.profissional p
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       WHERE p.ativo = TRUE
       ORDER BY u.nome`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    registrarErro('Erro ao listar profissionais:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function obterMeuPerfil(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.idprofissional, p.usuario_idusuario, u.nome, u.email,
              p.especialidade, p.ativo,
              EXISTS (
                SELECT 1
                FROM public.horario_profissional hp
                WHERE hp.profissional_idprofissional = p.idprofissional
              ) AS escala_personalizada
       FROM public.profissional p
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       WHERE p.usuario_idusuario = $1
         AND p.ativo = TRUE`,
      [req.userId]
    )

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Perfil profissional não encontrado ou inativo.' })
    }
    return res.status(200).json(result.rows[0])
  } catch (err) {
    registrarErro('Erro ao carregar o perfil profissional:', err)
    return res.status(500).json({ message: 'Não foi possível carregar o perfil profissional.' })
  }
}

async function listarGestao(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.idprofissional, p.usuario_idusuario, u.nome, u.email,
              p.especialidade, p.ativo,
              COUNT(a.idagendamento)::integer AS total_agendamentos,
              COUNT(a.idagendamento) FILTER (
                WHERE a.statusagendamento = 'AGENDADO'
                  AND a.dataagendamento >= CURRENT_DATE
              )::integer AS proximos_agendamentos,
              EXISTS (
                SELECT 1 FROM public.horario_profissional hp
                WHERE hp.profissional_idprofissional = p.idprofissional
              ) AS escala_personalizada
       FROM public.profissional p
       JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
       LEFT JOIN public.agendamento a ON a.profissional_idprofissional = p.idprofissional
       GROUP BY p.idprofissional, p.usuario_idusuario, u.nome, u.email,
                p.especialidade, p.ativo
       ORDER BY p.ativo DESC, u.nome`
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    registrarErro('Erro ao listar gestão de profissionais:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  }
}

async function criar(req, res) {
  const dados = validarProfissional(req.body, { exigirSenha: true })
  if (dados.erro) return res.status(400).json({ message: dados.erro })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existente = await client.query(
      'SELECT idusuario FROM public.usuario WHERE LOWER(BTRIM(email)) = $1',
      [dados.email]
    )
    if (existente.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'E-mail já cadastrado.' })
    }

    const senha = await bcrypt.hash(dados.password, 10)
    const usuario = await client.query(
      `INSERT INTO public.usuario (nome, email, senha)
       VALUES ($1, $2, $3)
       RETURNING idusuario, nome, email`,
      [dados.nome, dados.email, senha]
    )
    const profissional = await client.query(
      `INSERT INTO public.profissional (usuario_idusuario, especialidade, ativo)
       VALUES ($1, $2, TRUE)
       RETURNING idprofissional, usuario_idusuario, especialidade, ativo`,
      [usuario.rows[0].idusuario, dados.especialidade]
    )
    await client.query('COMMIT')
    return res.status(201).json({
      ...profissional.rows[0],
      nome: usuario.rows[0].nome,
      email: usuario.rows[0].email,
      total_agendamentos: 0,
      proximos_agendamentos: 0,
      escala_personalizada: false,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ message: 'E-mail já cadastrado.' })
    registrarErro('Erro ao cadastrar profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function atualizar(req, res) {
  const { id } = req.params
  if (!idValido(id)) return res.status(400).json({ message: 'Profissional inválido.' })
  const dados = validarProfissional(req.body)
  if (dados.erro) return res.status(400).json({ message: dados.erro })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const atual = await client.query(
      `SELECT p.usuario_idusuario
       FROM public.profissional p
       WHERE p.idprofissional = $1
       FOR UPDATE`,
      [id]
    )
    if (!atual.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Profissional não encontrado.' })
    }

    const duplicado = await client.query(
      `SELECT idusuario FROM public.usuario
       WHERE LOWER(BTRIM(email)) = $1 AND idusuario <> $2`,
      [dados.email, atual.rows[0].usuario_idusuario]
    )
    if (duplicado.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'E-mail já cadastrado.' })
    }

    const novaSenha = dados.password ? await bcrypt.hash(dados.password, 10) : null
    const usuario = await client.query(
      `UPDATE public.usuario
       SET nome = $1,
           email = $2,
           senha = COALESCE($3, senha),
           token_version = token_version + CASE WHEN $3::text IS NULL THEN 0 ELSE 1 END
       WHERE idusuario = $4
       RETURNING idusuario, nome, email`,
      [dados.nome, dados.email, novaSenha, atual.rows[0].usuario_idusuario]
    )
    const profissional = await client.query(
      `UPDATE public.profissional
       SET especialidade = $1
       WHERE idprofissional = $2
       RETURNING idprofissional, usuario_idusuario, especialidade, ativo`,
      [dados.especialidade, id]
    )
    await client.query('COMMIT')
    return res.status(200).json({ ...profissional.rows[0], nome: usuario.rows[0].nome, email: usuario.rows[0].email })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ message: 'E-mail já cadastrado.' })
    registrarErro('Erro ao atualizar profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

async function alterarStatus(req, res) {
  const { id } = req.params
  const { ativo } = req.body || {}
  if (!idValido(id)) return res.status(400).json({ message: 'Profissional inválido.' })
  if (typeof ativo !== 'boolean') return res.status(400).json({ message: 'Informe uma situação válida.' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const profissional = await client.query(
      'SELECT idprofissional, ativo FROM public.profissional WHERE idprofissional = $1 FOR UPDATE',
      [id]
    )
    if (!profissional.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Profissional não encontrado.' })
    }
    if (!ativo) {
      const futuros = await client.query(
        `SELECT COUNT(*)::integer AS total
         FROM public.agendamento
         WHERE profissional_idprofissional = $1
           AND statusagendamento = 'AGENDADO'
           AND dataagendamento >= CURRENT_DATE`,
        [id]
      )
      if (futuros.rows[0].total > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          message: `O profissional possui ${futuros.rows[0].total} agendamento(s) futuro(s) e não pode ser desativado.`,
        })
      }
    }
    const atualizado = await client.query(
      'UPDATE public.profissional SET ativo = $1 WHERE idprofissional = $2 RETURNING idprofissional, ativo',
      [ativo, id]
    )
    if (!ativo) {
      await client.query(
        `UPDATE public.usuario
         SET token_version = token_version + 1
         WHERE idusuario = (
           SELECT usuario_idusuario FROM public.profissional WHERE idprofissional = $1
         )`,
        [id]
      )
    }
    await client.query('COMMIT')
    return res.status(200).json(atualizado.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    registrarErro('Erro ao alterar situação do profissional:', err)
    return res.status(500).json({ message: 'Erro interno no servidor.' })
  } finally {
    client.release()
  }
}

module.exports = {
  listar,
  obterMeuPerfil,
  listarGestao,
  criar,
  atualizar,
  alterarStatus,
  validarProfissional,
}

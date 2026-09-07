require('dotenv').config()

const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const resultados = []
let ausenciaCriada = null
let agendaCriada = null
let adminToken
let clienteToken
let profissionalId

function registrar(id, descricao, estado, detalhe = '') {
  resultados.push({ id, descricao, resultado: estado, detalhe: estado === 'APROVADO' ? '' : detalhe })
}

async function http(caminho, token, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    ...opcoes,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(opcoes.headers || {}),
    },
  })
  let corpo = null
  try { corpo = await resposta.json() } catch { /* sem JSON */ }
  return { status: resposta.status, corpo }
}

function assinar(usuario, role) {
  return signToken({ id: usuario.idusuario, email: usuario.email, role, tokenVersion: usuario.token_version })
}

function iso(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

async function dataLivreDoDia(diaSemana, inicioDias) {
  const data = new Date()
  data.setHours(12, 0, 0, 0)
  data.setDate(data.getDate() + inicioDias)
  for (let i = 0; i < 400; i += 1) {
    if (data.getDay() === diaSemana) {
      const candidata = iso(data)
      const conflito = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM public.agenda WHERE data = $1::date)
          OR EXISTS (SELECT 1 FROM public.feriado WHERE data = $1::date) AS existe`, [candidata]
      )
      if (!conflito.rows[0].existe) return candidata
    }
    data.setDate(data.getDate() + 1)
  }
  throw new Error('Não foi encontrada uma data livre para o teste.')
}

async function calendario(data, servicoId) {
  const [ano, mes] = data.split('-').map(Number)
  const resposta = await http(
    `/agenda/calendario?ano=${ano}&mes=${mes}&servicoId=${servicoId}&profissionalId=${profissionalId}`,
    clienteToken,
  )
  return { resposta, dia: resposta.corpo?.find((item) => item.data === data) }
}

async function horarios(data, servicoId) {
  return http(`/agenda/horarios-disponiveis?data=${data}&servicoId=${servicoId}&profissionalId=${profissionalId}`, clienteToken)
}

function minutos(hora) {
  const [h, m] = String(hora).split(':').map(Number)
  return h * 60 + m
}

async function main() {
  const [admin, cliente, profissional, servico] = await Promise.all([
    pool.query(`SELECT u.idusuario, u.email, u.token_version FROM public.usuario u
      JOIN public.administrador a ON a.usuario_idusuario = u.idusuario ORDER BY u.idusuario LIMIT 1`),
    pool.query(`SELECT u.idusuario, u.email, u.token_version FROM public.usuario u
      JOIN public.cliente c ON c.usuario_idusuario = u.idusuario ORDER BY u.idusuario DESC LIMIT 1`),
    pool.query('SELECT idprofissional FROM public.profissional WHERE ativo = TRUE ORDER BY idprofissional LIMIT 1'),
    pool.query("SELECT idservico, duracao FROM public.servico WHERE tipo = 'servico' ORDER BY duracao, idservico LIMIT 1"),
  ])
  if (!admin.rows[0] || !cliente.rows[0] || !profissional.rows[0] || !servico.rows[0]) {
    throw new Error('Dados básicos não encontrados.')
  }
  adminToken = assinar(admin.rows[0], 'admin')
  clienteToken = assinar(cliente.rows[0], 'cliente')
  profissionalId = profissional.rows[0].idprofissional
  const servicoId = servico.rows[0].idservico

  const escala = await http(`/agenda/profissionais/${profissionalId}/horarios`, adminToken)
  if (escala.status !== 200 || !Array.isArray(escala.corpo)) throw new Error('Não foi possível carregar a escala efetiva.')
  const fechado = escala.corpo.find((item) => !item.ativo)
  if (fechado) {
    const dataFechada = await dataLivreDoDia(Number(fechado.dia_semana), 40)
    const consulta = await calendario(dataFechada, servicoId)
    const lista = await horarios(dataFechada, servicoId)
    registrar('CT-AGEND-17A', 'Dia semanal fechado não oferece horários',
      consulta.resposta.status === 200 && consulta.dia?.disponivel === false
        && lista.status === 200 && lista.corpo?.horarios?.length === 0 ? 'APROVADO' : 'REPROVADO',
      JSON.stringify({ calendario: consulta.dia, horarios: lista.corpo }))
  } else {
    registrar('CT-AGEND-17A', 'Dia semanal fechado não oferece horários', 'BLOQUEADO', 'A escala não possui dia fechado.')
  }

  const comIntervalo = escala.corpo.find((item) => item.ativo && item.intervalo_ativo)
  if (comIntervalo) {
    const dataIntervalo = await dataLivreDoDia(Number(comIntervalo.dia_semana), 60)
    const lista = await horarios(dataIntervalo, servicoId)
    const inicioIntervalo = minutos(comIntervalo.hora_inicio_intervalo)
    const fimIntervalo = minutos(comIntervalo.hora_fim_intervalo)
    const cruza = (lista.corpo?.horarios || []).some((item) => {
      const inicio = minutos(item.inicio)
      return inicio < fimIntervalo && inicio + Number(servico.rows[0].duracao) > inicioIntervalo
    })
    registrar('CT-AGEND-17B', 'Intervalo não oferece horários incompatíveis',
      lista.status === 200 && !cruza ? 'APROVADO' : 'REPROVADO',
      cruza ? 'Foi oferecido horário que cruza o intervalo.' : JSON.stringify(lista.corpo))
  } else {
    registrar('CT-AGEND-17B', 'Intervalo não oferece horários incompatíveis', 'BLOQUEADO', 'A escala não possui intervalo ativo.')
  }

  const anoAtual = new Date().getFullYear()
  let feriadoFechado = null
  for (const ano of [anoAtual, anoAtual + 1]) {
    const feriados = await http(`/agenda/feriados?ano=${ano}`, adminToken)
    feriadoFechado = feriados.corpo?.find((item) => item.data >= iso(new Date()) && item.modo_funcionamento === 'fechado')
    if (feriadoFechado) break
  }
  if (feriadoFechado) {
    const consulta = await calendario(feriadoFechado.data, servicoId)
    const lista = await horarios(feriadoFechado.data, servicoId)
    registrar('CT-AGEND-17C', 'Feriado fechado não oferece horários',
      consulta.dia?.disponivel === false && lista.corpo?.horarios?.length === 0 ? 'APROVADO' : 'REPROVADO',
      JSON.stringify({ feriado: feriadoFechado, calendario: consulta.dia, horarios: lista.corpo }))
  } else {
    registrar('CT-AGEND-17C', 'Feriado fechado não oferece horários', 'BLOQUEADO', 'Não há feriado futuro fechado cadastrado.')
  }

  const diaAberto = escala.corpo.find((item) => item.ativo)
  const dataBloqueada = await dataLivreDoDia(Number(diaAberto.dia_semana), 520)
  const criada = await http('/agenda', adminToken, {
    method: 'POST', body: JSON.stringify({ data: dataBloqueada, disponivel: false }),
  })
  if (criada.status !== 201) throw new Error(`Falha ao criar data bloqueada: ${criada.corpo?.message}`)
  agendaCriada = criada.corpo.idagenda
  const bloqueada = await calendario(dataBloqueada, servicoId)
  const horariosBloqueados = await horarios(dataBloqueada, servicoId)
  registrar('CT-AGEND-17D', 'Data especial bloqueada não oferece horários',
    bloqueada.dia?.disponivel === false && horariosBloqueados.corpo?.horarios?.length === 0 ? 'APROVADO' : 'REPROVADO',
    JSON.stringify({ calendario: bloqueada.dia, horarios: horariosBloqueados.corpo }))
  const removida = await http(`/agenda/${agendaCriada}`, adminToken, { method: 'DELETE' })
  if (removida.status === 200) agendaCriada = null

  const dataAusencia = await dataLivreDoDia(Number(diaAberto.dia_semana), 560)
  const ausencia = await http(`/agenda/profissionais/${profissionalId}/ausencias`, adminToken, {
    method: 'POST', body: JSON.stringify({
      tipo: 'FOLGA', datainicio: dataAusencia, datafim: dataAusencia, descricao: 'Teste temporário BAR-46',
    }),
  })
  if (ausencia.status !== 201) throw new Error(`Falha ao criar ausência: ${ausencia.corpo?.message}`)
  ausenciaCriada = ausencia.corpo.iddisponibilidade
  const indisponivel = await calendario(dataAusencia, servicoId)
  const horariosAusencia = await horarios(dataAusencia, servicoId)
  registrar('CT-AGEND-17E', 'Ausência individual bloqueia somente a agenda profissional',
    indisponivel.dia?.disponivel === false && horariosAusencia.corpo?.horarios?.length === 0 ? 'APROVADO' : 'REPROVADO',
    JSON.stringify({ calendario: indisponivel.dia, horarios: horariosAusencia.corpo }))
  const ausenciaRemovida = await http(`/agenda/profissionais/${profissionalId}/ausencias/${ausenciaCriada}`, adminToken, { method: 'DELETE' })
  if (ausenciaRemovida.status === 200) ausenciaCriada = null

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    bloqueados: resultados.filter((item) => item.resultado === 'BLOQUEADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha inesperada no teste de disponibilidade.', detalhe: erro.message }))
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (ausenciaCriada && adminToken) {
        await http(`/agenda/profissionais/${profissionalId}/ausencias/${ausenciaCriada}`, adminToken, { method: 'DELETE' })
      }
      if (agendaCriada && adminToken) await http(`/agenda/${agendaCriada}`, adminToken, { method: 'DELETE' })
    } finally {
      await pool.end()
    }
  })

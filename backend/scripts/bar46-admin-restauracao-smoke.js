require('dotenv').config()

const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const resultados = []
let adminToken
let horariosOriginais
let clienteOriginal

function registrar(id, descricao, resposta, esperado, detalhe = '') {
  const aprovado = resposta.status === esperado
  resultados.push({
    id, descricao, statusHttp: resposta.status,
    resultado: aprovado ? 'APROVADO' : 'REPROVADO',
    detalhe: aprovado ? '' : detalhe || resposta.corpo?.message || `Esperado HTTP ${esperado}.`,
  })
}

async function http(caminho, token, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    ...opcoes,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers || {}),
    },
  })
  let corpo = null
  try { corpo = await resposta.json() } catch { /* resposta sem JSON */ }
  return { status: resposta.status, corpo }
}

function adicionarMinuto(hora) {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + 1
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function payloadHorarios(horarios) {
  return horarios.map((item) => ({
    dia_semana: Number(item.dia_semana),
    hora_abertura: item.hora_abertura,
    hora_fechamento: item.hora_fechamento,
    ativo: Boolean(item.ativo),
    intervalo_ativo: Boolean(item.intervalo_ativo),
    hora_inicio_intervalo: item.hora_inicio_intervalo,
    hora_fim_intervalo: item.hora_fim_intervalo,
  }))
}

async function main() {
  const admin = await pool.query(
    `SELECT u.idusuario, u.email, u.token_version
     FROM public.usuario u JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
     ORDER BY u.idusuario LIMIT 1`
  )
  if (!admin.rows[0]) throw new Error('Administrador necessário para o teste.')
  adminToken = signToken({
    id: admin.rows[0].idusuario,
    email: admin.rows[0].email,
    role: 'admin',
    tokenVersion: admin.rows[0].token_version,
  })

  const horarios = await http('/agenda/horarios', adminToken)
  registrar('CT-ADMIN-16A', 'Carregar horários antes da alteração', horarios, 200)
  horariosOriginais = payloadHorarios(horarios.corpo)
  const indice = horariosOriginais.findIndex((item) => item.ativo && item.hora_fechamento < '23:59')
  if (indice < 0) throw new Error('Nenhum dia permite ampliar o fechamento em um minuto.')
  const horariosAlterados = horariosOriginais.map((item) => ({ ...item }))
  horariosAlterados[indice].hora_fechamento = adicionarMinuto(horariosAlterados[indice].hora_fechamento)

  const alteracao = await http('/agenda/horarios', adminToken, {
    method: 'PUT', body: JSON.stringify({ horarios: horariosAlterados }),
  })
  registrar('CT-ADMIN-16B', 'Ampliar um horário de fechamento em um minuto', alteracao, 200)
  const conferencia = await http('/agenda/horarios', adminToken)
  const refletiu = conferencia.status === 200
    && conferencia.corpo.some((item) => Number(item.dia_semana) === horariosAlterados[indice].dia_semana
      && item.hora_fechamento === horariosAlterados[indice].hora_fechamento)
  resultados.push({
    id: 'CT-ADMIN-16C', descricao: 'Alteração refletida na consulta', statusHttp: conferencia.status,
    resultado: refletiu ? 'APROVADO' : 'REPROVADO',
    detalhe: refletiu ? '' : 'O fechamento alterado não foi retornado pela API.',
  })
  const restauracao = await http('/agenda/horarios', adminToken, {
    method: 'PUT', body: JSON.stringify({ horarios: horariosOriginais }),
  })
  registrar('CT-ADMIN-16D', 'Restaurar configuração semanal original', restauracao, 200)
  if (restauracao.status === 200) horariosOriginais = null

  const gestao = await http('/clientes/gestao', adminToken)
  registrar('CT-ADMIN-19A', 'Carregar clientes para edição controlada', gestao, 200)
  const cliente = gestao.corpo?.find((item) => item.email?.startsWith('bar46.agendamento.') && Number(item.total_agendamentos) > 0)
    || gestao.corpo?.find((item) => item.email?.startsWith('bar46.') && Number(item.total_agendamentos) > 0)
  if (!cliente) throw new Error('Nenhum cliente BAR-46 com histórico foi encontrado.')
  clienteOriginal = {
    idcliente: cliente.idcliente,
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone,
  }
  const historicoAntes = await http(`/clientes/${cliente.idcliente}/agendamentos`, adminToken)
  registrar('CT-ADMIN-19B', 'Consultar histórico antes da edição', historicoAntes, 200)

  const nomeTeste = `${cliente.nome} Editado`
  const edicao = await http(`/clientes/${cliente.idcliente}`, adminToken, {
    method: 'PUT', body: JSON.stringify({
      nome: nomeTeste,
      email: cliente.email,
      telefone: cliente.telefone === '18999995555' ? '18999995556' : '18999995555',
    }),
  })
  registrar('CT-ADMIN-19C', 'Editar dados do cliente', edicao, 200)
  const historicoDepois = await http(`/clientes/${cliente.idcliente}/agendamentos`, adminToken)
  registrar('CT-ADMIN-19D', 'Consultar histórico após a edição', historicoDepois, 200)
  const idsAntes = (historicoAntes.corpo || []).map((item) => item.idagendamento).sort().join(',')
  const idsDepois = (historicoDepois.corpo || []).map((item) => item.idagendamento).sort().join(',')
  const preservado = idsAntes.length > 0 && idsAntes === idsDepois
  resultados.push({
    id: 'CT-ADMIN-19E', descricao: 'Histórico preservado depois da edição', statusHttp: 200,
    resultado: preservado ? 'APROVADO' : 'REPROVADO',
    detalhe: preservado ? '' : 'A relação de agendamentos foi alterada.',
  })
  const restaurarCliente = await http(`/clientes/${cliente.idcliente}`, adminToken, {
    method: 'PUT', body: JSON.stringify(clienteOriginal),
  })
  registrar('CT-ADMIN-19F', 'Restaurar dados originais do cliente', restaurarCliente, 200)
  if (restaurarCliente.status === 200) clienteOriginal = null

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({ erro: 'Falha inesperada na restauração administrativa.', detalhe: erro.message }))
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (horariosOriginais && adminToken) {
        await http('/agenda/horarios', adminToken, { method: 'PUT', body: JSON.stringify({ horarios: horariosOriginais }) })
      }
      if (clienteOriginal && adminToken) {
        await http(`/clientes/${clienteOriginal.idcliente}`, adminToken, {
          method: 'PUT', body: JSON.stringify(clienteOriginal),
        })
      }
    } finally {
      await pool.end()
    }
  })

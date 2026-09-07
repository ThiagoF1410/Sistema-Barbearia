require('dotenv').config()

const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const resultados = []
const criados = {
  usuarios: [], clientes: [], profissional: null, solicitacoes: [],
  disponibilidades: [], agendamentos: [], agendas: [], servicos: [],
}

function registrar(id, descricao, aprovado, statusHttp = null, detalhe = '') {
  resultados.push({
    id, descricao, statusHttp,
    resultado: aprovado ? 'APROVADO' : 'REPROVADO',
    detalhe: aprovado ? '' : detalhe,
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

async function esperar(id, descricao, caminho, token, opcoes, statusEsperado) {
  const resposta = await http(caminho, token, opcoes)
  registrar(id, descricao, resposta.status === statusEsperado, resposta.status,
    resposta.corpo?.message || `Esperado HTTP ${statusEsperado}.`)
  return resposta
}

function jwt(usuario, role) {
  return signToken({
    id: usuario.idusuario,
    email: usuario.email,
    role,
    tokenVersion: usuario.token_version,
  })
}

function isoMaisDias(dias) {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  return data.toISOString().slice(0, 10)
}

async function criarCliente(sufixo) {
  const email = `bar46.regras.${sufixo}.${Date.now()}@example.com`
  const resposta = await http('/clientes', null, {
    method: 'POST',
    body: JSON.stringify({
      nome: `Cliente Regras BAR 46 ${sufixo}`,
      email,
      telefone: sufixo === 'a' ? '18999996661' : '18999996662',
      password: 'TesteBar46@2026',
    }),
  })
  if (resposta.status !== 201) throw new Error(`Falha ao criar cliente ${sufixo}: ${resposta.corpo?.message}`)
  const usuario = await pool.query(
    `SELECT u.idusuario, u.email, u.token_version, c.idcliente
     FROM public.usuario u JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
     WHERE u.email = $1`, [email]
  )
  criados.usuarios.push(usuario.rows[0].idusuario)
  criados.clientes.push(usuario.rows[0].idcliente)
  return { ...usuario.rows[0], token: resposta.corpo.token, email }
}

async function encontrarHorario(token, servicoId, profissionalId) {
  const agora = new Date()
  for (let deslocamento = 0; deslocamento < 8; deslocamento += 1) {
    const referencia = new Date(agora.getFullYear(), agora.getMonth() + deslocamento, 1)
    const ano = referencia.getFullYear()
    const mes = referencia.getMonth() + 1
    const calendario = await http(
      `/agenda/calendario?ano=${ano}&mes=${mes}&servicoId=${servicoId}&profissionalId=${profissionalId}`,
      token,
    )
    const dia = calendario.corpo?.find((item) => item.disponivel)
    if (!dia) continue
    const horarios = await http(
      `/agenda/horarios-disponiveis?data=${dia.data}&servicoId=${servicoId}&profissionalId=${profissionalId}`,
      token,
    )
    if (horarios.corpo?.horarios?.length) {
      return { data: dia.data, horario: horarios.corpo.horarios[0].inicio }
    }
  }
  throw new Error('Não foi encontrado horário disponível para o teste concorrente.')
}

async function inserirAgendamento({ clienteId, profissionalId, servico, instante, status = 'AGENDADO' }) {
  const agenda = await pool.query(
    `INSERT INTO public.agenda (data, disponivel)
     VALUES ($1::date, TRUE)
     ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data
     RETURNING idagenda`, [instante.data]
  )
  const inserido = await pool.query(
    `INSERT INTO public.agendamento
      (agenda_idagenda, cliente_idcliente, profissional_idprofissional,
       servico_idservico, dataagendamento, horario, statusagendamento,
       servico_nome_snapshot, duracao_snapshot, valor_snapshot)
     VALUES ($1, $2, $3, $4, $5::date, $6::time, $7, $8, $9, $10)
     RETURNING idagendamento`,
    [agenda.rows[0].idagenda, clienteId, profissionalId, servico.idservico,
      instante.data, instante.horario, status, servico.nome, servico.duracao, servico.preco]
  )
  criados.agendas.push(agenda.rows[0].idagenda)
  criados.agendamentos.push(inserido.rows[0].idagendamento)
  return inserido.rows[0].idagendamento
}

async function limpar() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (criados.agendamentos.length) {
      await client.query('DELETE FROM public.pagamento WHERE agendamento_idagendamento = ANY($1::int[])', [criados.agendamentos])
      await client.query('DELETE FROM public.agendamento WHERE idagendamento = ANY($1::int[])', [criados.agendamentos])
    }
    if (criados.solicitacoes.length) {
      await client.query("DELETE FROM public.notificacao WHERE referencia_tipo = 'solicitacao_ausencia' AND referencia_id = ANY($1::bigint[])", [criados.solicitacoes])
      await client.query('DELETE FROM public.solicitacao_ausencia_profissional WHERE idsolicitacao = ANY($1::int[])', [criados.solicitacoes])
    }
    if (criados.disponibilidades.length) {
      await client.query('DELETE FROM public.disponibilidade WHERE iddisponibilidade = ANY($1::int[])', [criados.disponibilidades])
    }
    if (criados.servicos.length) {
      await client.query('DELETE FROM public.servico WHERE idservico = ANY($1::int[])', [criados.servicos])
    }
    if (criados.agendas.length) {
      await client.query(`DELETE FROM public.agenda ag WHERE ag.idagenda = ANY($1::int[])
        AND NOT EXISTS (SELECT 1 FROM public.agendamento a WHERE a.agenda_idagenda = ag.idagenda)`, [criados.agendas])
    }
    if (criados.profissional) {
      await client.query('DELETE FROM public.horario_profissional WHERE profissional_idprofissional = $1', [criados.profissional])
      await client.query('DELETE FROM public.profissional WHERE idprofissional = $1', [criados.profissional])
    }
    if (criados.clientes.length) {
      await client.query('DELETE FROM public.cliente WHERE idcliente = ANY($1::int[])', [criados.clientes])
    }
    if (criados.usuarios.length) {
      await client.query('DELETE FROM public.usuario WHERE idusuario = ANY($1::int[])', [criados.usuarios])
    }
    await client.query('COMMIT')
  } catch (erro) {
    await client.query('ROLLBACK')
    throw erro
  } finally {
    client.release()
  }
}

async function main() {
  const adminResult = await pool.query(
    `SELECT u.idusuario, u.email, u.token_version
     FROM public.usuario u JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
     ORDER BY u.idusuario LIMIT 1`
  )
  if (!adminResult.rows[0]) throw new Error('Administrador necessário para o teste.')
  const adminToken = jwt(adminResult.rows[0], 'admin')
  const clienteA = await criarCliente('a')
  const clienteB = await criarCliente('b')

  const marcador = Date.now()
  const profissionalCriado = await esperar(
    'CT-ADMIN-18A', 'Cadastrar profissional', '/profissionais', adminToken,
    { method: 'POST', body: JSON.stringify({
      nome: `Profissional BAR 46 ${marcador}`,
      email: `bar46.profissional.${marcador}@example.com`,
      especialidade: 'Testes de agenda',
      password: 'TesteBar46@2026',
    }) }, 201
  )
  if (!profissionalCriado.corpo?.idprofissional) throw new Error('Profissional de teste não foi criado.')
  criados.profissional = profissionalCriado.corpo.idprofissional
  criados.usuarios.push(profissionalCriado.corpo.usuario_idusuario)

  const profissionalUsuario = await pool.query(
    'SELECT idusuario, email, token_version FROM public.usuario WHERE idusuario = $1',
    [profissionalCriado.corpo.usuario_idusuario]
  )
  const profissionalToken = jwt(profissionalUsuario.rows[0], 'profissional')
  await esperar('CT-ADMIN-18B', 'Editar profissional', `/profissionais/${criados.profissional}`, adminToken,
    { method: 'PUT', body: JSON.stringify({
      nome: `Profissional BAR 46 Editado ${marcador}`,
      email: `bar46.profissional.${marcador}@example.com`,
      especialidade: 'Agenda e atendimento',
    }) }, 200)

  const dataEspecial = isoMaisDias(700 + (marcador % 25))
  const criada = await esperar('CT-ADMIN-17A', 'Criar data especial', '/agenda', adminToken,
    { method: 'POST', body: JSON.stringify({ data: dataEspecial, disponivel: true }) }, 201)
  if (criada.corpo?.idagenda) criados.agendas.push(criada.corpo.idagenda)
  await esperar('CT-ADMIN-17B', 'Bloquear data especial', `/agenda/${criada.corpo.idagenda}/disponibilidade`, adminToken,
    { method: 'PATCH', body: JSON.stringify({ disponivel: false }) }, 200)
  await esperar('CT-ADMIN-17C', 'Liberar data especial', `/agenda/${criada.corpo.idagenda}/disponibilidade`, adminToken,
    { method: 'PATCH', body: JSON.stringify({ disponivel: true }) }, 200)
  await esperar('CT-ADMIN-17D', 'Remover data especial', `/agenda/${criada.corpo.idagenda}`, adminToken,
    { method: 'DELETE' }, 200)

  const dataCancelada = isoMaisDias(400 + (marcador % 20))
  const solicitacaoCancelada = await esperar('CT-PROF-09A', 'Profissional solicita folga', '/agenda/profissional/solicitacoes-ausencia', profissionalToken,
    { method: 'POST', body: JSON.stringify({ tipo: 'FOLGA', datainicio: dataCancelada, datafim: dataCancelada, motivo: 'Teste BAR-46' }) }, 201)
  if (solicitacaoCancelada.corpo?.idsolicitacao) criados.solicitacoes.push(solicitacaoCancelada.corpo.idsolicitacao)
  await esperar('CT-PROF-09B', 'Profissional cancela solicitação pendente', `/agenda/profissional/solicitacoes-ausencia/${solicitacaoCancelada.corpo.idsolicitacao}`, profissionalToken,
    { method: 'DELETE' }, 200)

  const dataAprovada = isoMaisDias(430 + (marcador % 20))
  const solicitacaoAprovada = await esperar('CT-PROF-10A', 'Criar solicitação para aprovação', '/agenda/profissional/solicitacoes-ausencia', profissionalToken,
    { method: 'POST', body: JSON.stringify({ tipo: 'FERIAS', datainicio: dataAprovada, datafim: dataAprovada, motivo: 'Aprovação BAR-46' }) }, 201)
  criados.solicitacoes.push(solicitacaoAprovada.corpo.idsolicitacao)
  const aprovada = await esperar('CT-PROF-10B', 'Administrador aprova solicitação', `/agenda/solicitacoes-ausencia/${solicitacaoAprovada.corpo.idsolicitacao}`, adminToken,
    { method: 'PATCH', body: JSON.stringify({ decisao: 'APROVAR', resposta: 'Aprovada no teste BAR-46.' }) }, 200)
  if (aprovada.corpo?.disponibilidade?.iddisponibilidade) criados.disponibilidades.push(aprovada.corpo.disponibilidade.iddisponibilidade)
  const ausencias = await esperar('CT-PROF-10C', 'Ausência aprovada aparece para o profissional', '/agenda/profissional/ausencias', profissionalToken, {}, 200)
  registrar('CT-PROF-10D', 'Período aprovado consta nas ausências',
    Array.isArray(ausencias.corpo) && ausencias.corpo.some((item) => item.datainicio === dataAprovada), 200,
    'A ausência aprovada não foi encontrada.')

  const dataRecusada = isoMaisDias(460 + (marcador % 20))
  const solicitacaoRecusada = await esperar('CT-PROF-10E', 'Criar solicitação para recusa', '/agenda/profissional/solicitacoes-ausencia', profissionalToken,
    { method: 'POST', body: JSON.stringify({ tipo: 'FOLGA', datainicio: dataRecusada, datafim: dataRecusada, motivo: 'Recusa BAR-46' }) }, 201)
  criados.solicitacoes.push(solicitacaoRecusada.corpo.idsolicitacao)
  await esperar('CT-PROF-10F', 'Administrador recusa solicitação com justificativa', `/agenda/solicitacoes-ausencia/${solicitacaoRecusada.corpo.idsolicitacao}`, adminToken,
    { method: 'PATCH', body: JSON.stringify({ decisao: 'RECUSAR', resposta: 'Período indisponível para folga.' }) }, 200)

  const catalogo = await http('/servicos', clienteA.token)
  const servico = catalogo.corpo?.filter((item) => String(item.tipo).toLowerCase() === 'servico')
    .sort((a, b) => Number(a.duracao) - Number(b.duracao))[0]
  if (!servico) throw new Error('Serviço ativo necessário para os testes.')

  const horario = await encontrarHorario(clienteA.token, servico.idservico, criados.profissional)
  const payload = JSON.stringify({
    servicoId: servico.idservico,
    profissionalId: criados.profissional,
    data: horario.data,
    horario: horario.horario,
  })
  const [concorrenteA, concorrenteB] = await Promise.all([
    http('/agendamentos', clienteA.token, { method: 'POST', body: payload }),
    http('/agendamentos', clienteB.token, { method: 'POST', body: payload }),
  ])
  const statuses = [concorrenteA.status, concorrenteB.status].sort((a, b) => a - b)
  registrar('CT-AGEND-18', 'Duas reservas simultâneas confirmam somente uma vaga',
    statuses[0] === 201 && statuses[1] === 409, statuses.join('/'),
    `Respostas obtidas: ${statuses.join(', ')}.`)
  const vencedor = concorrenteA.status === 201
    ? { resposta: concorrenteA, cliente: clienteA }
    : { resposta: concorrenteB, cliente: clienteB }
  if (vencedor.resposta.corpo?.idagendamento) {
    criados.agendamentos.push(vencedor.resposta.corpo.idagendamento)
    await http(`/agendamentos/${vencedor.resposta.corpo.idagendamento}/cancelar`, vencedor.cliente.token, { method: 'PATCH' })
  }

  const instante = await pool.query(
    `SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '90 minutes', 'YYYY-MM-DD') AS data,
            TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '90 minutes', 'HH24:MI') AS horario,
            TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '4 hours', 'YYYY-MM-DD') AS data_concluir,
            TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '4 hours', 'HH24:MI') AS hora_concluir`
  )
  const prazoId = await inserirAgendamento({
    clienteId: clienteA.idcliente, profissionalId: criados.profissional, servico,
    instante: { data: instante.rows[0].data, horario: instante.rows[0].horario },
  })
  await esperar('CT-AGEND-15', 'Bloquear cancelamento com menos de duas horas', `/agendamentos/${prazoId}/cancelar`, clienteA.token,
    { method: 'PATCH' }, 409)

  const concluirId = await inserirAgendamento({
    clienteId: clienteB.idcliente, profissionalId: criados.profissional, servico,
    instante: { data: instante.rows[0].data_concluir, horario: instante.rows[0].hora_concluir },
  })
  await esperar('CT-ADMIN-20A', 'Bloquear conclusão antes do término', `/agendamentos/${concluirId}/concluir`, adminToken,
    { method: 'PATCH' }, 409)
  await pool.query("UPDATE public.agendamento SET dataagendamento = CURRENT_DATE - INTERVAL '1 day', horario = '08:00' WHERE idagendamento = $1", [concluirId])
  await esperar('CT-ADMIN-20B', 'Concluir atendimento após o término', `/agendamentos/${concluirId}/concluir`, adminToken,
    { method: 'PATCH' }, 200)

  const servicoVinculado = await esperar('CT-SERV-07A', 'Criar serviço para teste de vínculo', '/servicos', adminToken,
    { method: 'POST', body: JSON.stringify({ nome: `Serviço Vinculado BAR 46 ${marcador}`, tipo: 'servico', duracao: 15, preco: 1, descricao: 'Teste temporário' }) }, 201)
  criados.servicos.push(servicoVinculado.corpo.idservico)
  await inserirAgendamento({
    clienteId: clienteA.idcliente, profissionalId: criados.profissional,
    servico: servicoVinculado.corpo,
    instante: { data: isoMaisDias(500 + (marcador % 20)), horario: '06:00' }, status: 'CANCELADO',
  })
  await esperar('CT-SERV-07B', 'Impedir exclusão de serviço com histórico vinculado', `/servicos/${servicoVinculado.corpo.idservico}`, adminToken,
    { method: 'DELETE' }, 409)

  await pool.query("UPDATE public.agendamento SET statusagendamento = 'CANCELADO' WHERE profissional_idprofissional = $1 AND idagendamento = ANY($2::int[])", [criados.profissional, criados.agendamentos])
  await esperar('CT-ADMIN-18C', 'Desativar profissional sem agenda ativa', `/profissionais/${criados.profissional}/status`, adminToken,
    { method: 'PATCH', body: JSON.stringify({ ativo: false }) }, 200)
  await esperar('CT-ADMIN-18D', 'Revogar sessão ao desativar profissional', '/profissionais/me', profissionalToken, {}, 401)

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
    console.error(JSON.stringify({ erro: 'Falha inesperada nos testes avançados.', detalhe: erro.message }))
    process.exitCode = 1
  })
  .finally(async () => {
    try { await limpar() } catch (erro) {
      console.error(JSON.stringify({ erro: 'Falha ao limpar dados temporários.', detalhe: erro.message }))
      process.exitCode = 1
    }
    await pool.end()
  })

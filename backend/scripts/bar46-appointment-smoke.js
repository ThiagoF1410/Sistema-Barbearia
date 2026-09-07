const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const resultados = []

async function requisitar(id, descricao, caminho, token, opcoes = {}, esperados = []) {
  try {
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
    const aprovado = esperados.includes(resposta.status)
    resultados.push({
      id,
      descricao,
      statusHttp: resposta.status,
      resultado: aprovado ? 'APROVADO' : 'REPROVADO',
      detalhe: aprovado ? '' : corpo?.message || 'Resposta diferente da esperada.',
    })
    return corpo
  } catch (erro) {
    resultados.push({ id, descricao, statusHttp: 0, resultado: 'BLOQUEADO', detalhe: erro.message })
    return null
  }
}

function proximosMeses(quantidade = 6) {
  const hoje = new Date()
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + indice, 1)
    return { ano: data.getFullYear(), mes: data.getMonth() + 1 }
  })
}

async function main() {
  const marcador = Date.now()
  const cadastro = {
    nome: 'Cliente Fluxo Agendamento BAR 46',
    email: `bar46.agendamento.${marcador}@example.com`,
    telefone: '18999997777',
    password: 'TesteBar46@2026',
  }
  const usuario = await requisitar('CT-AGEND-01', 'Preparação do cliente de teste', '/auth/register', null, {
    method: 'POST', body: JSON.stringify(cadastro),
  }, [201])
  const token = usuario?.token
  if (!token) throw new Error('Não foi possível autenticar o cliente de teste.')

  const servicos = await requisitar('CT-AGEND-02', 'Carregamento dos serviços', '/servicos', token, {}, [200])
  const profissionais = await requisitar('CT-AGEND-03', 'Carregamento dos profissionais', '/profissionais', token, {}, [200])
  const servico = servicos?.filter((item) => String(item.tipo).toLowerCase() === 'servico')
    .sort((a, b) => Number(a.duracao) - Number(b.duracao))[0]
  const profissional = profissionais?.[0]
  if (!servico || !profissional) throw new Error('O catálogo precisa de serviço e profissional ativo para o teste.')

  await requisitar('CT-AGEND-04', 'Recusa de agendamento no passado', '/agendamentos', token, {
    method: 'POST',
    body: JSON.stringify({ servicoId: servico.idservico, profissionalId: profissional.idprofissional, data: '2020-01-01', horario: '10:00' }),
  }, [409])

  let escolha = null
  for (const referencia of proximosMeses()) {
    const calendario = await requisitar(
      `CT-AGEND-CAL-${referencia.ano}-${referencia.mes}`,
      `Calendário individual ${referencia.mes}/${referencia.ano}`,
      `/agenda/calendario?ano=${referencia.ano}&mes=${referencia.mes}&servicoId=${servico.idservico}&profissionalId=${profissional.idprofissional}`,
      token,
      {},
      [200]
    )
    const dia = calendario?.find((item) => item.disponivel)
    if (!dia) continue
    const horarios = await requisitar('CT-AGEND-05', 'Listagem de horários livres por duração', `/agenda/horarios-disponiveis?data=${dia.data}&servicoId=${servico.idservico}&profissionalId=${profissional.idprofissional}`, token, {}, [200])
    if (horarios?.horarios?.length) {
      escolha = { data: dia.data, horario: horarios.horarios[0].inicio }
      break
    }
  }
  if (!escolha) throw new Error('Não foi encontrado horário livre nos próximos seis meses.')

  const payload = {
    servicoId: servico.idservico,
    profissionalId: profissional.idprofissional,
    data: escolha.data,
    horario: escolha.horario,
  }
  const agendamento = await requisitar('CT-AGEND-06', 'Criação de agendamento válido', '/agendamentos', token, {
    method: 'POST', body: JSON.stringify(payload),
  }, [201])
  const agendamentoId = agendamento?.idagendamento
  if (!agendamentoId) throw new Error('A API não retornou o identificador do agendamento.')

  await requisitar('CT-AGEND-07', 'Bloqueio de conflito no mesmo horário', '/agendamentos', token, {
    method: 'POST', body: JSON.stringify(payload),
  }, [409])
  const aposReserva = await requisitar('CT-AGEND-08', 'Reconsulta da disponibilidade após reservar', `/agenda/horarios-disponiveis?data=${escolha.data}&servicoId=${servico.idservico}&profissionalId=${profissional.idprofissional}`, token, {}, [200])
  const horarioBloqueado = !aposReserva?.horarios?.some((item) => item.inicio === escolha.horario)
  resultados.push({
    id: 'CT-AGEND-09',
    descricao: 'Horário reservado removido da disponibilidade',
    statusHttp: 200,
    resultado: horarioBloqueado ? 'APROVADO' : 'REPROVADO',
    detalhe: horarioBloqueado ? '' : 'O horário continuou disponível após a reserva.',
  })
  await requisitar('CT-AGEND-10', 'Agendamento aparece no histórico do cliente', '/agendamentos/meus', token, {}, [200])
  await requisitar('CT-AGEND-11', 'Cancelamento com antecedência superior a duas horas', `/agendamentos/${agendamentoId}/cancelar`, token, { method: 'PATCH' }, [200])
  await requisitar('CT-AGEND-12', 'Bloqueio de segundo cancelamento', `/agendamentos/${agendamentoId}/cancelar`, token, { method: 'PATCH' }, [409])
  const aposCancelamento = await requisitar('CT-AGEND-13', 'Reconsulta da disponibilidade após cancelar', `/agenda/horarios-disponiveis?data=${escolha.data}&servicoId=${servico.idservico}&profissionalId=${profissional.idprofissional}`, token, {}, [200])
  const horarioLiberado = aposCancelamento?.horarios?.some((item) => item.inicio === escolha.horario)
  resultados.push({
    id: 'CT-AGEND-14',
    descricao: 'Horário liberado após o cancelamento',
    statusHttp: 200,
    resultado: horarioLiberado ? 'APROVADO' : 'REPROVADO',
    detalhe: horarioLiberado ? '' : 'O horário não voltou à lista após o cancelamento.',
  })

  const resumo = {
    contaTeste: cadastro.email,
    agendamentoTeste: agendamentoId,
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    bloqueados: resultados.filter((item) => item.resultado === 'BLOQUEADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados || resumo.bloqueados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(JSON.stringify({ erro: 'Falha inesperada no fluxo de agendamento.', detalhe: erro.message }))
  process.exitCode = 1
})

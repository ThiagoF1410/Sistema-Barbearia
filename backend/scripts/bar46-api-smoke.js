const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const identificador = Date.now()
const contaTeste = `bar46.qa.${identificador}@example.com`
const senhaTeste = 'TesteBar46@2026'
const resultados = []

async function executar(id, descricao, caminho, opcoes = {}, statusEsperados = []) {
  try {
    const resposta = await fetch(`${baseUrl}${caminho}`, {
      ...opcoes,
      headers: {
        'content-type': 'application/json',
        ...(opcoes.headers || {}),
      },
    })
    let corpo = null
    try {
      corpo = await resposta.json()
    } catch {
      // Algumas respostas válidas podem não possuir JSON.
    }

    const aprovado = statusEsperados.includes(resposta.status)
    resultados.push({
      id,
      descricao,
      statusHttp: resposta.status,
      resultado: aprovado ? 'APROVADO' : 'REPROVADO',
      detalhe: aprovado ? '' : corpo?.message || 'Resposta diferente da esperada.',
    })
    return corpo
  } catch (erro) {
    resultados.push({
      id,
      descricao,
      statusHttp: 0,
      resultado: 'BLOQUEADO',
      detalhe: erro.message,
    })
    return null
  }
}

async function main() {
  const cadastroValido = {
    nome: 'Cliente Teste BAR 46',
    email: contaTeste,
    telefone: '18999998888',
    password: senhaTeste,
  }

  await executar('CT-AUTH-01', 'Cadastro sem campos obrigatórios', '/auth/register', {
    method: 'POST', body: '{}',
  }, [400])
  await executar('CT-AUTH-02', 'Cadastro com e-mail inválido', '/clientes', {
    method: 'POST', body: JSON.stringify({ ...cadastroValido, email: 'email-invalido' }),
  }, [400])
  const cadastro = await executar('CT-AUTH-03', 'Cadastro válido de cliente', '/auth/register', {
    method: 'POST', body: JSON.stringify(cadastroValido),
  }, [201])
  await executar('CT-AUTH-04', 'Bloqueio de e-mail duplicado', '/clientes', {
    method: 'POST', body: JSON.stringify(cadastroValido),
  }, [409])
  await executar('CT-AUTH-05', 'Login com senha incorreta', '/auth/login', {
    method: 'POST', body: JSON.stringify({ email: contaTeste, password: 'SenhaIncorreta' }),
  }, [401])
  const login = await executar('CT-AUTH-06', 'Login válido de cliente', '/auth/login', {
    method: 'POST', body: JSON.stringify({ email: contaTeste, password: senhaTeste }),
  }, [200])

  const token = login?.token || cadastro?.token
  const autenticado = { authorization: `Bearer ${token}` }

  await executar('CT-AUTH-07', 'Bloqueio de perfil sem token', '/auth/me', {}, [401])
  await executar('CT-AUTH-08', 'Consulta do perfil autenticado', '/auth/me', {
    headers: autenticado,
  }, [200])
  await executar('CT-SEC-01', 'Cliente bloqueado em rota administrativa', '/agendamentos/admin', {
    headers: autenticado,
  }, [403])
  await executar('CT-SEC-02', 'Cliente bloqueado nas notificações internas', '/notificacoes', {
    headers: autenticado,
  }, [403])
  await executar('CT-CAT-01', 'Listagem pública do catálogo', '/servicos', {}, [200])
  await executar('CT-PROF-01', 'Listagem de profissionais autenticada', '/profissionais', {
    headers: autenticado,
  }, [200])
  await executar('CT-AGENDA-01', 'Recusa de mês e ano inválidos', '/agenda/calendario?ano=abc&mes=13', {
    headers: autenticado,
  }, [400])
  await executar('CT-AGENDA-02', 'Consulta do calendário mensal', '/agenda/calendario?ano=2026&mes=9', {
    headers: autenticado,
  }, [200])
  await executar('CT-AGENDA-03', 'Recusa de parâmetros de horário inválidos', '/agenda/horarios-disponiveis?data=invalida&servicoId=x&profissionalId=y', {
    headers: autenticado,
  }, [400])
  await executar('CT-CLIENTE-01', 'Histórico do cliente', '/agendamentos/meus', {
    headers: autenticado,
  }, [200])
  await executar('CT-LOJA-01', 'Pedidos do cliente', '/pedidos/meus', {
    headers: autenticado,
  }, [200])
  await executar('CT-PERFIL-01', 'Recusa de telefone inválido no perfil', '/auth/me', {
    method: 'PATCH', headers: autenticado,
    body: JSON.stringify({ nome: cadastroValido.nome, email: contaTeste, telefone: '1' }),
  }, [400])
  await executar('CT-PERFIL-02', 'Atualização válida do perfil', '/auth/me', {
    method: 'PATCH', headers: autenticado,
    body: JSON.stringify({ nome: 'Cliente Teste BAR 46 Validado', email: contaTeste, telefone: cadastroValido.telefone }),
  }, [200])

  const resumo = {
    contaTeste,
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    bloqueados: resultados.filter((item) => item.resultado === 'BLOQUEADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados || resumo.bloqueados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(JSON.stringify({ erro: 'Falha inesperada no smoke test.', detalhe: erro.message }))
  process.exitCode = 1
})

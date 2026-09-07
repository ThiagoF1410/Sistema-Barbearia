require('dotenv').config()

const pool = require('../src/config/db')
const { signToken } = require('../src/utils/authUtils')

const baseUrl = process.env.BAR46_API_URL || 'http://localhost:3001/api'
const resultados = []

function registrar(id, descricao, statusHttp, statusEsperados, detalhe = '') {
  const bloqueado = statusHttp === 0
  resultados.push({
    id,
    descricao,
    statusHttp,
    resultado: bloqueado ? 'BLOQUEADO' : statusEsperados.includes(statusHttp) ? 'APROVADO' : 'REPROVADO',
    detalhe,
  })
}

async function executar(id, descricao, caminho, token, opcoes = {}, statusEsperados = []) {
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
    registrar(id, descricao, resposta.status, statusEsperados, statusEsperados.includes(resposta.status) ? '' : corpo?.message)
    return corpo
  } catch (erro) {
    registrar(id, descricao, 0, statusEsperados, erro.message)
    return null
  }
}

async function obterIdentidades() {
  const [admin, profissional, cliente] = await Promise.all([
    pool.query(`SELECT u.idusuario, u.email, u.token_version
      FROM public.usuario u JOIN public.administrador a ON a.usuario_idusuario = u.idusuario
      ORDER BY u.idusuario LIMIT 1`),
    pool.query(`SELECT u.idusuario, u.email, u.token_version
      FROM public.usuario u JOIN public.profissional p ON p.usuario_idusuario = u.idusuario
      WHERE p.ativo = TRUE ORDER BY u.idusuario LIMIT 1`),
    pool.query(`SELECT u.idusuario, u.email, u.token_version
      FROM public.usuario u JOIN public.cliente c ON c.usuario_idusuario = u.idusuario
      ORDER BY u.idusuario DESC LIMIT 1`),
  ])
  return {
    admin: admin.rows[0],
    profissional: profissional.rows[0],
    cliente: cliente.rows[0],
  }
}

function criarToken(usuario, role) {
  if (!usuario) return null
  return signToken({
    id: usuario.idusuario,
    email: usuario.email,
    role,
    tokenVersion: usuario.token_version,
  })
}

async function main() {
  const identidades = await obterIdentidades()
  const admin = criarToken(identidades.admin, 'admin')
  const profissional = criarToken(identidades.profissional, 'profissional')
  const cliente = criarToken(identidades.cliente, 'cliente')

  if (!admin) registrar('CT-ADMIN-00', 'Existência de administrador para os testes', 0, [], 'Nenhum administrador cadastrado.')
  if (!profissional) registrar('CT-PROF-00', 'Existência de profissional ativo para os testes', 0, [], 'Nenhum profissional ativo cadastrado.')

  let servicoTesteId = null
  if (admin) {
    await executar('CT-ADMIN-01', 'Perfil administrativo', '/auth/me', admin, {}, [200])
    await executar('CT-ADMIN-02', 'Dashboard administrativo', '/agendamentos/admin/dashboard?data=2026-09-03', admin, {}, [200])
    await executar('CT-ADMIN-03', 'Listagem filtrada de agendamentos', '/agendamentos/admin?dataInicio=2026-09-01&dataFim=2026-09-30', admin, {}, [200])
    await executar('CT-ADMIN-04', 'Recusa de situação de agendamento inválida', '/agendamentos/admin?status=INVALIDO', admin, {}, [400])
    await executar('CT-ADMIN-05', 'Listagem administrativa de pagamentos', '/pagamentos/admin', admin, {}, [200])
    await executar('CT-ADMIN-06', 'Recusa de situação de pagamento inválida', '/pagamentos/admin?status=INVALIDO', admin, {}, [400])
    await executar('CT-ADMIN-07', 'Relatório financeiro anual', '/pagamentos/admin/relatorio-mensal?ano=2026', admin, {}, [200])
    await executar('CT-ADMIN-08', 'Recusa de ano inválido no relatório', '/pagamentos/admin/relatorio-mensal?ano=1999', admin, {}, [400])
    await executar('CT-ADMIN-09', 'Datas especiais da agenda', '/agenda', admin, {}, [200])
    await executar('CT-ADMIN-10', 'Horários de funcionamento', '/agenda/horarios', admin, {}, [200])
    await executar('CT-ADMIN-11', 'Feriados do ano', '/agenda/feriados?ano=2026', admin, {}, [200])
    await executar('CT-ADMIN-12', 'Gestão de profissionais', '/profissionais/gestao', admin, {}, [200])
    await executar('CT-ADMIN-13', 'Gestão de clientes', '/clientes/gestao', admin, {}, [200])
    await executar('CT-ADMIN-14', 'Solicitações de ausência', '/agenda/solicitacoes-ausencia', admin, {}, [200])
    await executar('CT-ADMIN-15', 'Central de notificações administrativa', '/notificacoes', admin, {}, [200])
    await executar('CT-SERV-01', 'Recusa de serviço inválido', '/servicos', admin, { method: 'POST', body: '{}' }, [400])

    const servico = await executar('CT-SERV-02', 'Criação de serviço temporário', '/servicos', admin, {
      method: 'POST',
      body: JSON.stringify({
        nome: `Serviço Teste BAR 46 ${Date.now()}`,
        tipo: 'servico',
        duracao: 30,
        preco: 1,
        descricao: 'Registro temporário criado pelo teste de aceitação.',
      }),
    }, [201])
    servicoTesteId = servico?.idservico
    if (servicoTesteId) {
      await executar('CT-SERV-03', 'Consulta do serviço temporário', `/servicos/${servicoTesteId}`, admin, {}, [200])
      await executar('CT-SERV-04', 'Edição do serviço temporário', `/servicos/${servicoTesteId}`, admin, {
        method: 'PUT',
        body: JSON.stringify({ nome: 'Serviço Teste BAR 46 Editado', tipo: 'servico', duracao: 60, preco: 2, descricao: 'Teste de edição.' }),
      }, [200])
      await executar('CT-SEC-03', 'Cliente impedido de editar serviço', `/servicos/${servicoTesteId}`, cliente, {
        method: 'PUT', body: JSON.stringify({ nome: 'Não autorizado', tipo: 'servico', duracao: 30, preco: 1 }),
      }, [403])
      await executar('CT-SERV-05', 'Exclusão do serviço temporário', `/servicos/${servicoTesteId}`, admin, { method: 'DELETE' }, [200])
      await executar('CT-SERV-06', 'Serviço removido deixa de ser encontrado', `/servicos/${servicoTesteId}`, admin, {}, [404])
      servicoTesteId = null
    }
  }

  if (profissional) {
    await executar('CT-PROF-01', 'Perfil do profissional', '/profissionais/me', profissional, {}, [200])
    await executar('CT-PROF-02', 'Dashboard do profissional', '/agendamentos/profissional/dashboard?data=2026-09-03', profissional, {}, [200])
    await executar('CT-PROF-03', 'Expediente do profissional', '/agenda/profissional/horarios', profissional, {}, [200])
    await executar('CT-PROF-04', 'Ausências confirmadas do profissional', '/agenda/profissional/ausencias', profissional, {}, [200])
    await executar('CT-PROF-05', 'Solicitações de ausência do profissional', '/agenda/profissional/solicitacoes-ausencia', profissional, {}, [200])
    await executar('CT-PROF-06', 'Central de notificações profissional', '/notificacoes', profissional, {}, [200])
    await executar('CT-PROF-07', 'Profissional impedido de acessar clientes', '/clientes/gestao', profissional, {}, [403])
    await executar('CT-PROF-08', 'Recusa de solicitação de ausência inválida', '/agenda/profissional/solicitacoes-ausencia', profissional, {
      method: 'POST', body: '{}',
    }, [400])
  }

  if (servicoTesteId && admin) {
    await executar('CT-SERV-LIMPEZA', 'Limpeza do serviço temporário após falha', `/servicos/${servicoTesteId}`, admin, { method: 'DELETE' }, [200])
  }

  const resumo = {
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    bloqueados: resultados.filter((item) => item.resultado === 'BLOQUEADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados || resumo.bloqueados) process.exitCode = 1
}

main()
  .catch((erro) => {
    console.error(JSON.stringify({
      erro: 'Falha inesperada no teste de perfis.',
      detalhe: erro.message || erro.code || 'Erro sem mensagem.',
      causas: Array.isArray(erro.errors)
        ? erro.errors.map((causa) => causa.code || causa.message || 'causa desconhecida')
        : [],
    }))
    process.exitCode = 1
  })
  .finally(() => pool.end())

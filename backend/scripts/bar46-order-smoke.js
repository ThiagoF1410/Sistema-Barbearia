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

async function main() {
  const marcador = Date.now()
  const cadastro = {
    nome: 'Cliente Fluxo Loja BAR 46',
    email: `bar46.loja.${marcador}@example.com`,
    telefone: '18999996666',
    password: 'TesteBar46@2026',
  }
  const usuario = await requisitar('CT-LOJA-01', 'Preparação do cliente da loja', '/auth/register', null, {
    method: 'POST', body: JSON.stringify(cadastro),
  }, [201])
  const token = usuario?.token
  if (!token) throw new Error('Não foi possível autenticar o cliente de teste.')

  const catalogo = await requisitar('CT-LOJA-02', 'Carregamento do catálogo', '/servicos', token, {}, [200])
  const produto = catalogo?.find((item) => String(item.tipo).toLowerCase() === 'produto')
  const servico = catalogo?.find((item) => String(item.tipo).toLowerCase() === 'servico')
  if (!produto) throw new Error('Nenhum produto cadastrado para executar o fluxo da loja.')

  await requisitar('CT-LOJA-03', 'Recusa de sacola vazia', '/pedidos/dinheiro', token, {
    method: 'POST', body: JSON.stringify({ itens: [] }),
  }, [400])
  if (servico) {
    await requisitar('CT-LOJA-04', 'Recusa de serviço usado como produto', '/pedidos/dinheiro', token, {
      method: 'POST', body: JSON.stringify({ itens: [{ produtoId: servico.idservico, quantidade: 1 }] }),
    }, [409])
  }
  await requisitar('CT-LOJA-05', 'Recusa de quantidade superior ao limite', '/pedidos/dinheiro', token, {
    method: 'POST', body: JSON.stringify({ itens: [{ produtoId: produto.idservico, quantidade: 21 }] }),
  }, [400])

  const pedidoDinheiro = await requisitar('CT-LOJA-06', 'Criação de pedido com pagamento em dinheiro', '/pedidos/dinheiro', token, {
    method: 'POST', body: JSON.stringify({ itens: [{ produtoId: produto.idservico, quantidade: 2 }] }),
  }, [201])
  await requisitar('CT-LOJA-07', 'Listagem do pedido criado', '/pedidos/meus', token, {}, [200])
  await requisitar('CT-LOJA-08', 'Pedido em dinheiro não abre checkout online', `/pedidos/${pedidoDinheiro?.pedidoId}/checkout`, token, {
    method: 'POST', body: JSON.stringify({ origemRetorno: 'http://localhost:5173' }),
  }, [409])
  await requisitar('CT-LOJA-09', 'Cancelamento de pedido em dinheiro pendente', `/pedidos/${pedidoDinheiro?.pedidoId}/cancelar`, token, {
    method: 'PATCH',
  }, [200])
  await requisitar('CT-LOJA-10', 'Segundo cancelamento é idempotente', `/pedidos/${pedidoDinheiro?.pedidoId}/cancelar`, token, {
    method: 'PATCH',
  }, [200])

  const pedidoOnline = await requisitar('CT-STRIPE-01', 'Criação de checkout online de produtos', '/pedidos/checkout', token, {
    method: 'POST',
    body: JSON.stringify({
      itens: [{ produtoId: produto.idservico, quantidade: 1 }],
      origemRetorno: 'http://localhost:5173',
    }),
  }, [201])
  const checkoutValido = Boolean(
    pedidoOnline?.pedidoId
      && pedidoOnline?.sessionId?.startsWith('cs_')
      && /^https:\/\//.test(pedidoOnline?.checkoutUrl || '')
      && pedidoOnline?.expiraEm
  )
  resultados.push({
    id: 'CT-STRIPE-02',
    descricao: 'Checkout retorna URL, sessão e prazo de pagamento',
    statusHttp: 201,
    resultado: checkoutValido ? 'APROVADO' : 'REPROVADO',
    detalhe: checkoutValido ? '' : 'A resposta do checkout não contém todos os campos esperados.',
  })
  if (pedidoOnline?.pedidoId) {
    await requisitar('CT-STRIPE-03', 'Retomada reutiliza checkout pendente', `/pedidos/${pedidoOnline.pedidoId}/checkout`, token, {
      method: 'POST', body: JSON.stringify({ origemRetorno: 'http://localhost:5173' }),
    }, [200])
    await requisitar('CT-STRIPE-04', 'Cancelamento expira checkout pendente', `/pedidos/${pedidoOnline.pedidoId}/cancelar`, token, {
      method: 'PATCH',
    }, [200])
    await requisitar('CT-STRIPE-05', 'Pedido cancelado não pode ser pago', `/pedidos/${pedidoOnline.pedidoId}/checkout`, token, {
      method: 'POST', body: JSON.stringify({ origemRetorno: 'http://localhost:5173' }),
    }, [409])
  }

  const resumo = {
    contaTeste: cadastro.email,
    pedidoDinheiro: pedidoDinheiro?.pedidoId || null,
    pedidoOnline: pedidoOnline?.pedidoId || null,
    total: resultados.length,
    aprovados: resultados.filter((item) => item.resultado === 'APROVADO').length,
    reprovados: resultados.filter((item) => item.resultado === 'REPROVADO').length,
    bloqueados: resultados.filter((item) => item.resultado === 'BLOQUEADO').length,
  }
  console.log(JSON.stringify({ resumo, resultados }, null, 2))
  if (resumo.reprovados || resumo.bloqueados) process.exitCode = 1
}

main().catch((erro) => {
  console.error(JSON.stringify({ erro: 'Falha inesperada no fluxo da loja.', detalhe: erro.message }))
  process.exitCode = 1
})

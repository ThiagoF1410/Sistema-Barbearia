const { registrarErro } = require('../utils/logger')
const pool = require('../config/db')
const { carregarProdutos, obterCliente, substituirItens, totalProdutos } = require('../services/pedidosService')

async function criarPedidoDinheiro(req, res) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cliente = await obterCliente(client, req.userId)
    if (!cliente) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Cadastro de cliente não encontrado.' })
    }

    const produtos = await carregarProdutos(client, req.body?.itens, true)
    const total = totalProdutos(produtos)
    const pedidoResult = await client.query(
      `INSERT INTO public.pedido (cliente_idcliente, tipo, status, total)
       VALUES ($1, 'AVULSO', 'PENDENTE', $2)
       RETURNING idpedido, total`,
      [cliente.idcliente, total]
    )
    const pedido = pedidoResult.rows[0]
    await substituirItens(client, pedido.idpedido, produtos)
    await client.query(
      `INSERT INTO public.pagamento
        (pedido_idpedido, datapagamento, valor, statuspagamento, metodo, moeda, atualizado_em)
       VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
               $2, 'PENDENTE', 'DINHEIRO', 'brl', NOW())`,
      [pedido.idpedido, total]
    )
    await client.query('COMMIT')
    return res.status(201).json({
      pedidoId: pedido.idpedido,
      status: 'PENDENTE',
      metodo: 'DINHEIRO',
      message: 'Pedido registrado. O pagamento deverá ser realizado em dinheiro na retirada.',
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (['ITENS_INVALIDOS', 'SACOLA_VAZIA'].includes(err.code)) {
      return res.status(400).json({ message: err.message })
    }
    if (err.code === 'PRODUTO_INDISPONIVEL') return res.status(409).json({ message: err.message })
    registrarErro('Erro ao criar pedido com pagamento em dinheiro:', err)
    return res.status(500).json({ message: 'Não foi possível registrar o pedido agora.' })
  } finally {
    client.release()
  }
}

module.exports = { criarPedidoDinheiro }

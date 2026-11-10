BEGIN;

CREATE OR REPLACE FUNCTION public.gerar_notificacao_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cliente VARCHAR(100);
  v_descricao VARCHAR(120);
  v_produtos TEXT;
  v_mensagem VARCHAR(500);
  v_novo_vinculo_produtos BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_novo_vinculo_produtos := NEW.agendamento_idagendamento IS NOT NULL
      AND NEW.pedido_idpedido IS NOT NULL;
  ELSE
    v_novo_vinculo_produtos := NEW.agendamento_idagendamento IS NOT NULL
      AND NEW.pedido_idpedido IS NOT NULL
      AND OLD.pedido_idpedido IS DISTINCT FROM NEW.pedido_idpedido;
  END IF;

  IF NEW.statuspagamento = 'CONFIRMADO'
     AND (TG_OP = 'INSERT' OR OLD.statuspagamento IS DISTINCT FROM 'CONFIRMADO') THEN
    IF NEW.agendamento_idagendamento IS NOT NULL THEN
      SELECT u.nome, COALESCE(a.servico_nome_snapshot, s.nome),
             COALESCE((
               SELECT STRING_AGG(pi.quantidade || '× ' || pi.nome_snapshot, ', ' ORDER BY pi.idpedidoitem)
               FROM public.pedido_item pi
               WHERE pi.pedido_idpedido = NEW.pedido_idpedido
             ), '')
        INTO v_cliente, v_descricao, v_produtos
      FROM public.agendamento a
      JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
      JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
      LEFT JOIN public.servico s ON s.idservico = a.servico_idservico
      WHERE a.idagendamento = NEW.agendamento_idagendamento;

      v_mensagem := 'Pagamento de ' || v_cliente || ' confirmado para ' || v_descricao
        || ' no valor de R$ ' || REPLACE(TO_CHAR(NEW.valor, 'FM999999990D00'), '.', ',')
        || CASE WHEN v_produtos <> '' THEN '. Produtos: ' || LEFT(v_produtos, 220) ELSE '' END || '.';
    ELSE
      SELECT u.nome,
             COALESCE(STRING_AGG(pi.quantidade || '× ' || pi.nome_snapshot, ', ' ORDER BY pi.idpedidoitem), '')
        INTO v_cliente, v_produtos
      FROM public.pedido pe
      JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
      JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
      LEFT JOIN public.pedido_item pi ON pi.pedido_idpedido = pe.idpedido
      WHERE pe.idpedido = NEW.pedido_idpedido
      GROUP BY u.nome;

      v_mensagem := 'Compra de produtos de ' || v_cliente || ' confirmada no valor de R$ '
        || REPLACE(TO_CHAR(NEW.valor, 'FM999999990D00'), '.', ',')
        || CASE WHEN v_produtos <> '' THEN '. Produtos: ' || LEFT(v_produtos, 220) ELSE '' END || '.';
    END IF;

    PERFORM public.notificar_administradores(
      'PAGAMENTO_CONFIRMADO',
      CASE WHEN NEW.agendamento_idagendamento IS NULL THEN 'Nova compra confirmada' ELSE 'Pagamento confirmado' END,
      v_mensagem, '/admin/pagamentos', 'PAGAMENTO', NEW.idpagamento,
      'PAGAMENTO_CONFIRMADO:' || NEW.idpagamento
    );
  ELSIF v_novo_vinculo_produtos THEN
    SELECT u.nome, COALESCE(a.servico_nome_snapshot, s.nome),
           COALESCE(STRING_AGG(pi.quantidade || '× ' || pi.nome_snapshot, ', ' ORDER BY pi.idpedidoitem), '')
      INTO v_cliente, v_descricao, v_produtos
    FROM public.agendamento a
    JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
    JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
    LEFT JOIN public.servico s ON s.idservico = a.servico_idservico
    JOIN public.pedido pe ON pe.idpedido = NEW.pedido_idpedido
    JOIN public.pedido_item pi ON pi.pedido_idpedido = pe.idpedido
    WHERE a.idagendamento = NEW.agendamento_idagendamento
    GROUP BY u.nome, COALESCE(a.servico_nome_snapshot, s.nome);

    IF v_produtos <> '' THEN
      v_mensagem := v_cliente || ' adicionou produtos ao agendamento de ' || v_descricao
        || ': ' || LEFT(v_produtos, 280) || '.';
      PERFORM public.notificar_administradores(
        'AGENDAMENTO_PRODUTOS', 'Agendamento com produtos', v_mensagem,
        '/admin/agendamentos', 'PEDIDO', NEW.pedido_idpedido,
        'AGENDAMENTO_PRODUTOS:' || NEW.pedido_idpedido
      );
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.metodo = 'DINHEIRO'
    AND NEW.statuspagamento = 'PENDENTE' AND NEW.pedido_idpedido IS NOT NULL
    AND NEW.agendamento_idagendamento IS NULL THEN
    SELECT u.nome INTO v_cliente
    FROM public.pedido pe
    JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
    JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
    WHERE pe.idpedido = NEW.pedido_idpedido;
    PERFORM public.notificar_administradores(
      'PEDIDO_DINHEIRO', 'Novo pedido em dinheiro',
      v_cliente || ' realizou um pedido de R$ '
        || REPLACE(TO_CHAR(NEW.valor, 'FM999999990D00'), '.', ',')
        || ' para pagamento na retirada.',
      '/admin/pagamentos', 'PEDIDO', NEW.pedido_idpedido,
      'PEDIDO_DINHEIRO:' || NEW.pedido_idpedido
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS central_notificacao_pagamento_trigger ON public.pagamento;
CREATE TRIGGER central_notificacao_pagamento_trigger
AFTER INSERT OR UPDATE OF statuspagamento, pedido_idpedido ON public.pagamento
FOR EACH ROW EXECUTE FUNCTION public.gerar_notificacao_pagamento();

COMMIT;

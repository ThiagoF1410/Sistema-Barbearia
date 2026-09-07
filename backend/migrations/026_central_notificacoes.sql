BEGIN;

CREATE TABLE IF NOT EXISTS public.notificacao (
  idnotificacao BIGSERIAL PRIMARY KEY,
  usuario_idusuario INTEGER NOT NULL
    REFERENCES public.usuario(idusuario) ON UPDATE CASCADE ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(120) NOT NULL,
  mensagem VARCHAR(500) NOT NULL,
  link VARCHAR(255) NOT NULL,
  referencia_tipo VARCHAR(40),
  referencia_id BIGINT,
  chave_evento VARCHAR(160) NOT NULL,
  lida_em TIMESTAMPTZ,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notificacao_usuario_evento_unique UNIQUE (usuario_idusuario, chave_evento)
);

CREATE INDEX IF NOT EXISTS notificacao_usuario_data_idx
  ON public.notificacao (usuario_idusuario, criada_em DESC);

CREATE INDEX IF NOT EXISTS notificacao_usuario_nao_lida_idx
  ON public.notificacao (usuario_idusuario, criada_em DESC)
  WHERE lida_em IS NULL;

CREATE OR REPLACE FUNCTION public.notificar_administradores(
  p_tipo VARCHAR,
  p_titulo VARCHAR,
  p_mensagem VARCHAR,
  p_link VARCHAR,
  p_referencia_tipo VARCHAR,
  p_referencia_id BIGINT,
  p_chave VARCHAR
)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.notificacao
    (usuario_idusuario, tipo, titulo, mensagem, link,
     referencia_tipo, referencia_id, chave_evento)
  SELECT a.usuario_idusuario, p_tipo, p_titulo, p_mensagem, p_link,
         p_referencia_tipo, p_referencia_id, p_chave
  FROM public.administrador a
  ON CONFLICT (usuario_idusuario, chave_evento) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.notificar_profissional(
  p_profissional_id INTEGER,
  p_tipo VARCHAR,
  p_titulo VARCHAR,
  p_mensagem VARCHAR,
  p_link VARCHAR,
  p_referencia_tipo VARCHAR,
  p_referencia_id BIGINT,
  p_chave VARCHAR
)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.notificacao
    (usuario_idusuario, tipo, titulo, mensagem, link,
     referencia_tipo, referencia_id, chave_evento)
  SELECT p.usuario_idusuario, p_tipo, p_titulo, p_mensagem, p_link,
         p_referencia_tipo, p_referencia_id, p_chave
  FROM public.profissional p
  WHERE p.idprofissional = p_profissional_id
  ON CONFLICT (usuario_idusuario, chave_evento) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.gerar_notificacao_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cliente VARCHAR(100);
  v_servico VARCHAR(100);
  v_mensagem VARCHAR(500);
BEGIN
  SELECT u.nome, COALESCE(NEW.servico_nome_snapshot, s.nome)
    INTO v_cliente, v_servico
  FROM public.cliente c
  JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
  LEFT JOIN public.servico s ON s.idservico = NEW.servico_idservico
  WHERE c.idcliente = NEW.cliente_idcliente;

  IF TG_OP = 'INSERT' THEN
    v_mensagem := v_cliente || ' agendou ' || v_servico || ' para '
      || TO_CHAR(NEW.dataagendamento, 'DD/MM/YYYY') || ' às '
      || TO_CHAR(NEW.horario, 'HH24:MI') || '.';
    PERFORM public.notificar_administradores(
      'AGENDAMENTO_NOVO', 'Novo agendamento', v_mensagem,
      '/admin/agendamentos', 'AGENDAMENTO', NEW.idagendamento,
      'AGENDAMENTO_NOVO:' || NEW.idagendamento
    );
    PERFORM public.notificar_profissional(
      NEW.profissional_idprofissional, 'AGENDAMENTO_NOVO',
      'Novo atendimento na agenda', v_mensagem,
      '/profissional?aba=agenda', 'AGENDAMENTO', NEW.idagendamento,
      'AGENDAMENTO_NOVO:' || NEW.idagendamento
    );
  ELSIF NEW.statusagendamento = 'CANCELADO'
    AND OLD.statusagendamento IS DISTINCT FROM 'CANCELADO' THEN
    v_mensagem := 'O agendamento de ' || v_cliente || ' para '
      || TO_CHAR(NEW.dataagendamento, 'DD/MM/YYYY') || ' às '
      || TO_CHAR(NEW.horario, 'HH24:MI') || ' foi cancelado.';
    PERFORM public.notificar_administradores(
      'AGENDAMENTO_CANCELADO', 'Agendamento cancelado', v_mensagem,
      '/admin/agendamentos', 'AGENDAMENTO', NEW.idagendamento,
      'AGENDAMENTO_CANCELADO:' || NEW.idagendamento
    );
    PERFORM public.notificar_profissional(
      NEW.profissional_idprofissional, 'AGENDAMENTO_CANCELADO',
      'Atendimento cancelado', v_mensagem,
      '/profissional?aba=agenda', 'AGENDAMENTO', NEW.idagendamento,
      'AGENDAMENTO_CANCELADO:' || NEW.idagendamento
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS central_notificacao_agendamento_trigger ON public.agendamento;
CREATE TRIGGER central_notificacao_agendamento_trigger
AFTER INSERT OR UPDATE OF statusagendamento ON public.agendamento
FOR EACH ROW EXECUTE FUNCTION public.gerar_notificacao_agendamento();

CREATE OR REPLACE FUNCTION public.gerar_notificacao_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cliente VARCHAR(100);
  v_descricao VARCHAR(120);
  v_mensagem VARCHAR(500);
BEGIN
  IF NEW.statuspagamento = 'CONFIRMADO'
     AND (TG_OP = 'INSERT' OR OLD.statuspagamento IS DISTINCT FROM 'CONFIRMADO') THEN
    IF NEW.agendamento_idagendamento IS NOT NULL THEN
      SELECT u.nome, COALESCE(a.servico_nome_snapshot, s.nome)
        INTO v_cliente, v_descricao
      FROM public.agendamento a
      JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
      JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
      LEFT JOIN public.servico s ON s.idservico = a.servico_idservico
      WHERE a.idagendamento = NEW.agendamento_idagendamento;
      v_mensagem := 'Pagamento de ' || v_cliente || ' confirmado para ' || v_descricao
        || ' no valor de R$ ' || REPLACE(TO_CHAR(NEW.valor, 'FM999999990D00'), '.', ',') || '.';
    ELSE
      SELECT u.nome INTO v_cliente
      FROM public.pedido pe
      JOIN public.cliente c ON c.idcliente = pe.cliente_idcliente
      JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
      WHERE pe.idpedido = NEW.pedido_idpedido;
      v_mensagem := 'Compra de produtos de ' || v_cliente || ' confirmada no valor de R$ '
        || REPLACE(TO_CHAR(NEW.valor, 'FM999999990D00'), '.', ',') || '.';
    END IF;
    PERFORM public.notificar_administradores(
      'PAGAMENTO_CONFIRMADO',
      CASE WHEN NEW.agendamento_idagendamento IS NULL THEN 'Nova compra confirmada' ELSE 'Pagamento confirmado' END,
      v_mensagem, '/admin/pagamentos', 'PAGAMENTO', NEW.idpagamento,
      'PAGAMENTO_CONFIRMADO:' || NEW.idpagamento
    );
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
AFTER INSERT OR UPDATE OF statuspagamento ON public.pagamento
FOR EACH ROW EXECUTE FUNCTION public.gerar_notificacao_pagamento();

CREATE OR REPLACE FUNCTION public.gerar_notificacao_pedido_cancelado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cliente VARCHAR(100);
BEGIN
  IF NEW.tipo = 'AVULSO' AND NEW.status = 'CANCELADO'
     AND OLD.status IS DISTINCT FROM 'CANCELADO' THEN
    SELECT u.nome INTO v_cliente
    FROM public.cliente c
    JOIN public.usuario u ON u.idusuario = c.usuario_idusuario
    WHERE c.idcliente = NEW.cliente_idcliente;
    PERFORM public.notificar_administradores(
      'PEDIDO_CANCELADO', 'Pedido cancelado',
      'O pedido nº ' || NEW.idpedido || ' de ' || v_cliente || ' foi cancelado.',
      '/admin/pagamentos', 'PEDIDO', NEW.idpedido,
      'PEDIDO_CANCELADO:' || NEW.idpedido
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS central_notificacao_pedido_trigger ON public.pedido;
CREATE TRIGGER central_notificacao_pedido_trigger
AFTER UPDATE OF status ON public.pedido
FOR EACH ROW EXECUTE FUNCTION public.gerar_notificacao_pedido_cancelado();

CREATE OR REPLACE FUNCTION public.gerar_notificacao_solicitacao_ausencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_profissional VARCHAR(100);
  v_mensagem VARCHAR(500);
BEGIN
  SELECT u.nome INTO v_profissional
  FROM public.profissional p
  JOIN public.usuario u ON u.idusuario = p.usuario_idusuario
  WHERE p.idprofissional = NEW.profissional_idprofissional;

  IF TG_OP = 'INSERT' THEN
    v_mensagem := v_profissional || ' solicitou ' || LOWER(NEW.tipo) || ' de '
      || TO_CHAR(NEW.datainicio, 'DD/MM/YYYY') || ' até '
      || TO_CHAR(NEW.datafim, 'DD/MM/YYYY') || '.';
    PERFORM public.notificar_administradores(
      'SOLICITACAO_AUSENCIA', 'Nova solicitação de ausência', v_mensagem,
      '/admin/agenda', 'SOLICITACAO_AUSENCIA', NEW.idsolicitacao,
      'SOLICITACAO_AUSENCIA:' || NEW.idsolicitacao
    );
  ELSIF NEW.status IN ('APROVADA', 'RECUSADA') AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_mensagem := 'Sua solicitação de ' || LOWER(NEW.tipo) || ' para o período de '
      || TO_CHAR(NEW.datainicio, 'DD/MM/YYYY') || ' a '
      || TO_CHAR(NEW.datafim, 'DD/MM/YYYY') || ' foi '
      || LOWER(NEW.status) || '.';
    PERFORM public.notificar_profissional(
      NEW.profissional_idprofissional, 'SOLICITACAO_' || NEW.status,
      CASE WHEN NEW.status = 'APROVADA' THEN 'Solicitação aprovada' ELSE 'Solicitação recusada' END,
      v_mensagem, '/profissional?aba=ausencias', 'SOLICITACAO_AUSENCIA', NEW.idsolicitacao,
      'SOLICITACAO_' || NEW.status || ':' || NEW.idsolicitacao
    );
  ELSIF NEW.status = 'CANCELADA' AND OLD.status IS DISTINCT FROM 'CANCELADA' THEN
    PERFORM public.notificar_administradores(
      'SOLICITACAO_CANCELADA', 'Solicitação cancelada',
      v_profissional || ' cancelou uma solicitação de ' || LOWER(NEW.tipo) || '.',
      '/admin/agenda', 'SOLICITACAO_AUSENCIA', NEW.idsolicitacao,
      'SOLICITACAO_CANCELADA:' || NEW.idsolicitacao
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS central_notificacao_ausencia_trigger
  ON public.solicitacao_ausencia_profissional;
CREATE TRIGGER central_notificacao_ausencia_trigger
AFTER INSERT OR UPDATE OF status ON public.solicitacao_ausencia_profissional
FOR EACH ROW EXECUTE FUNCTION public.gerar_notificacao_solicitacao_ausencia();

COMMIT;

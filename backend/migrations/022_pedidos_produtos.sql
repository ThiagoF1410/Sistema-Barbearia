BEGIN;

CREATE TABLE IF NOT EXISTS public.pedido (
  idpedido BIGSERIAL PRIMARY KEY,
  cliente_idcliente INTEGER NOT NULL
    REFERENCES public.cliente(idcliente) ON UPDATE CASCADE ON DELETE RESTRICT,
  agendamento_idagendamento INTEGER
    REFERENCES public.agendamento(idagendamento) ON UPDATE CASCADE ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('AVULSO', 'AGENDAMENTO')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU')),
  total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pedido_tipo_vinculo_check CHECK (
    (tipo = 'AVULSO' AND agendamento_idagendamento IS NULL)
    OR (tipo = 'AGENDAMENTO' AND agendamento_idagendamento IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pedido_agendamento_unique_idx
  ON public.pedido (agendamento_idagendamento)
  WHERE agendamento_idagendamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS pedido_cliente_data_idx
  ON public.pedido (cliente_idcliente, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.pedido_item (
  idpedidoitem BIGSERIAL PRIMARY KEY,
  pedido_idpedido BIGINT NOT NULL
    REFERENCES public.pedido(idpedido) ON UPDATE CASCADE ON DELETE CASCADE,
  produto_idservico INTEGER NOT NULL
    REFERENCES public.servico(idservico) ON UPDATE CASCADE ON DELETE RESTRICT,
  nome_snapshot VARCHAR(100) NOT NULL,
  preco_snapshot NUMERIC(10, 2) NOT NULL CHECK (preco_snapshot >= 0),
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 20),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  CONSTRAINT pedido_item_produto_unique UNIQUE (pedido_idpedido, produto_idservico)
);

ALTER TABLE public.pagamento
  ADD COLUMN IF NOT EXISTS pedido_idpedido BIGINT;

ALTER TABLE public.pagamento
  ALTER COLUMN agendamento_idagendamento DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pagamento'::regclass
      AND conname = 'pagamento_pedido_fkey'
  ) THEN
    ALTER TABLE public.pagamento
      ADD CONSTRAINT pagamento_pedido_fkey
      FOREIGN KEY (pedido_idpedido)
      REFERENCES public.pedido(idpedido)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pagamento'::regclass
      AND conname = 'pagamento_origem_check'
  ) THEN
    ALTER TABLE public.pagamento
      ADD CONSTRAINT pagamento_origem_check
      CHECK (agendamento_idagendamento IS NOT NULL OR pedido_idpedido IS NOT NULL);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS pagamento_pedido_unique_idx
  ON public.pagamento (pedido_idpedido)
  WHERE pedido_idpedido IS NOT NULL;

-- O gatilho legado só deve gerar WhatsApp para pagamentos vinculados a horário.
CREATE OR REPLACE FUNCTION public.registrar_confirmacao_pagamento_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.agendamento_idagendamento IS NOT NULL
     AND NEW.statuspagamento = 'CONFIRMADO'
     AND (TG_OP = 'INSERT' OR OLD.statuspagamento IS DISTINCT FROM 'CONFIRMADO') THEN
    INSERT INTO public.whatsapp_notificacao
      (agendamento_idagendamento, tipo)
    VALUES
      (NEW.agendamento_idagendamento, 'PAGAMENTO_CONFIRMADO')
    ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

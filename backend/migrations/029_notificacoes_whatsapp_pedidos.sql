BEGIN;

ALTER TABLE public.whatsapp_notificacao
  ALTER COLUMN agendamento_idagendamento DROP NOT NULL;

ALTER TABLE public.whatsapp_notificacao
  ADD COLUMN IF NOT EXISTS pedido_idpedido INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_notificacao_pedido_fkey') THEN
    ALTER TABLE public.whatsapp_notificacao
      ADD CONSTRAINT whatsapp_notificacao_pedido_fkey
      FOREIGN KEY (pedido_idpedido) REFERENCES public.pedido(idpedido)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_notificacao_origem_check') THEN
    ALTER TABLE public.whatsapp_notificacao
      ADD CONSTRAINT whatsapp_notificacao_origem_check
      CHECK ((agendamento_idagendamento IS NOT NULL) <> (pedido_idpedido IS NOT NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_notificacao_pedido_tipo_unique_idx
  ON public.whatsapp_notificacao (pedido_idpedido, tipo)
  WHERE pedido_idpedido IS NOT NULL;

CREATE OR REPLACE FUNCTION public.registrar_confirmacao_pagamento_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.statuspagamento = 'CONFIRMADO'
     AND (TG_OP = 'INSERT' OR OLD.statuspagamento IS DISTINCT FROM 'CONFIRMADO') THEN
    IF NEW.agendamento_idagendamento IS NOT NULL THEN
      INSERT INTO public.whatsapp_notificacao (agendamento_idagendamento, tipo)
      VALUES (NEW.agendamento_idagendamento, 'PAGAMENTO_CONFIRMADO')
      ON CONFLICT (agendamento_idagendamento, tipo) DO NOTHING;
    ELSIF NEW.pedido_idpedido IS NOT NULL THEN
      INSERT INTO public.whatsapp_notificacao (pedido_idpedido, tipo)
      VALUES (NEW.pedido_idpedido, 'PEDIDO_PAGAMENTO_CONFIRMADO')
      ON CONFLICT (pedido_idpedido, tipo) WHERE pedido_idpedido IS NOT NULL DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

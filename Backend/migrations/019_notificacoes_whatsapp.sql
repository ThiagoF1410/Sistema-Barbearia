BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_notificacao (
  idnotificacao BIGSERIAL PRIMARY KEY,
  agendamento_idagendamento INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  tentativas SMALLINT NOT NULL DEFAULT 0,
  proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_id VARCHAR(255),
  ultimo_erro VARCHAR(80),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_em TIMESTAMPTZ,

  CONSTRAINT whatsapp_notificacao_agendamento_fkey
    FOREIGN KEY (agendamento_idagendamento)
    REFERENCES public.agendamento(idagendamento)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT whatsapp_notificacao_tipo_unique
    UNIQUE (agendamento_idagendamento, tipo),
  CONSTRAINT whatsapp_notificacao_status_valido
    CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU')),
  CONSTRAINT whatsapp_notificacao_tentativas_valida
    CHECK (tentativas BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS whatsapp_notificacao_pendentes_idx
  ON public.whatsapp_notificacao (proxima_tentativa_em, idnotificacao)
  WHERE status IN ('PENDENTE', 'FALHOU');

CREATE OR REPLACE FUNCTION public.registrar_confirmacao_pagamento_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.statuspagamento = 'CONFIRMADO'
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

DROP TRIGGER IF EXISTS pagamento_confirmado_whatsapp_trigger
  ON public.pagamento;

CREATE TRIGGER pagamento_confirmado_whatsapp_trigger
AFTER INSERT OR UPDATE OF statuspagamento
ON public.pagamento
FOR EACH ROW
EXECUTE FUNCTION public.registrar_confirmacao_pagamento_whatsapp();

COMMIT;

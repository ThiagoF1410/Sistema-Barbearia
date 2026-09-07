BEGIN;

ALTER TABLE public.pagamento
  ADD COLUMN IF NOT EXISTS datapagamento DATE DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE),
  ADD COLUMN IF NOT EXISTS statuspagamento VARCHAR(20) DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS metodo VARCHAR(30) DEFAULT 'STRIPE',
  ADD COLUMN IF NOT EXISTS moeda CHAR(3) DEFAULT 'brl',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamento' AND column_name = 'status'
  ) THEN
    EXECUTE $sql$
      UPDATE public.pagamento
      SET statuspagamento = CASE LOWER(status)
        WHEN 'confirmado' THEN 'CONFIRMADO'
        WHEN 'cancelado' THEN 'CANCELADO'
        WHEN 'falhou' THEN 'FALHOU'
        ELSE 'PENDENTE'
      END
      WHERE status IS NOT NULL
    $sql$;
  END IF;
END
$$;

UPDATE public.pagamento
SET datapagamento = COALESCE(datapagamento, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE),
    statuspagamento = COALESCE(statuspagamento, 'PENDENTE'),
    metodo = COALESCE(metodo, 'STRIPE'),
    moeda = COALESCE(moeda, 'brl'),
    criado_em = COALESCE(criado_em, NOW()),
    atualizado_em = COALESCE(atualizado_em, NOW());

ALTER TABLE public.pagamento
  ALTER COLUMN datapagamento SET DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE),
  ALTER COLUMN datapagamento SET NOT NULL,
  ALTER COLUMN statuspagamento SET DEFAULT 'PENDENTE',
  ALTER COLUMN statuspagamento SET NOT NULL,
  ALTER COLUMN metodo SET DEFAULT 'STRIPE',
  ALTER COLUMN metodo SET NOT NULL,
  ALTER COLUMN moeda SET DEFAULT 'brl',
  ALTER COLUMN moeda SET NOT NULL,
  ALTER COLUMN criado_em SET DEFAULT NOW(),
  ALTER COLUMN criado_em SET NOT NULL,
  ALTER COLUMN atualizado_em SET DEFAULT NOW(),
  ALTER COLUMN atualizado_em SET NOT NULL;

ALTER TABLE public.pagamento
  DROP CONSTRAINT IF EXISTS pagamento_status_valido,
  DROP COLUMN IF EXISTS status;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pagamento_statuspagamento_valido'
      AND conrelid = 'public.pagamento'::regclass
  ) THEN
    ALTER TABLE public.pagamento
      ADD CONSTRAINT pagamento_statuspagamento_valido
      CHECK (statuspagamento IN ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS pagamento_agendamento_unique_idx
  ON public.pagamento (agendamento_idagendamento);
CREATE UNIQUE INDEX IF NOT EXISTS pagamento_checkout_session_unique_idx
  ON public.pagamento (stripe_checkout_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS pagamento_payment_intent_unique_idx
  ON public.pagamento (stripe_payment_intent_id);

DROP INDEX IF EXISTS public.pagamento_status_idx;
CREATE INDEX pagamento_status_idx ON public.pagamento (statuspagamento);

COMMIT;

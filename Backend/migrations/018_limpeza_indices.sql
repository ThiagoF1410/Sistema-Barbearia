BEGIN;

-- As migrações antigas combinavam UNIQUE inline e índices únicos com outros
-- nomes. Mantém somente os índices canônicos usados pelo backend.
DO $$
DECLARE
  restricao RECORD;
BEGIN
  FOR restricao IN
    SELECT DISTINCT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.pagamento'::regclass
      AND c.contype = 'u'
      AND a.attname IN (
        'agendamento_idagendamento',
        'stripe_checkout_session_id',
        'stripe_payment_intent_id'
      )
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.pagamento DROP CONSTRAINT %I', restricao.conname);
  END LOOP;
END
$$;

DROP INDEX IF EXISTS public.pagamento_checkout_session_idx;
DROP INDEX IF EXISTS public.pagamento_agendamento_unique_idx;
DROP INDEX IF EXISTS public.pagamento_checkout_session_unique_idx;
DROP INDEX IF EXISTS public.pagamento_payment_intent_unique_idx;
DROP INDEX IF EXISTS public.feriado_data_idx;

CREATE UNIQUE INDEX pagamento_agendamento_unique_idx
  ON public.pagamento (agendamento_idagendamento);

CREATE UNIQUE INDEX pagamento_checkout_session_unique_idx
  ON public.pagamento (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX pagamento_payment_intent_unique_idx
  ON public.pagamento (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMIT;

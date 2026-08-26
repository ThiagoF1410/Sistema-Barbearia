CREATE TABLE IF NOT EXISTS public.stripe_evento (
  stripe_evento_id VARCHAR(255) PRIMARY KEY,
  tipo VARCHAR(100) NOT NULL,
  processado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_evento_processado_idx
  ON public.stripe_evento (processado_em);

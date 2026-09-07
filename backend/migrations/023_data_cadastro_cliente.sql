BEGIN;

ALTER TABLE public.cliente
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ;

UPDATE public.cliente c
SET criado_em = COALESCE(
  (
    SELECT MIN(a.dataagendamento)::timestamp AT TIME ZONE 'America/Sao_Paulo'
    FROM public.agendamento a
    WHERE a.cliente_idcliente = c.idcliente
  ),
  CURRENT_TIMESTAMP
)
WHERE c.criado_em IS NULL;

ALTER TABLE public.cliente
  ALTER COLUMN criado_em SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN criado_em SET NOT NULL;

CREATE INDEX IF NOT EXISTS cliente_criado_em_idx
  ON public.cliente (criado_em);

COMMIT;

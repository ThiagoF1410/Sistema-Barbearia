ALTER TABLE public.horario_funcionamento
  ADD COLUMN IF NOT EXISTS intervalo_ativo BOOLEAN,
  ADD COLUMN IF NOT EXISTS hora_inicio_intervalo TIME,
  ADD COLUMN IF NOT EXISTS hora_fim_intervalo TIME;

UPDATE public.horario_funcionamento
SET intervalo_ativo = ativo,
    hora_inicio_intervalo = CASE WHEN ativo THEN '12:00'::time ELSE NULL END,
    hora_fim_intervalo = CASE WHEN ativo THEN '14:00'::time ELSE NULL END
WHERE intervalo_ativo IS NULL;

ALTER TABLE public.horario_funcionamento
  ALTER COLUMN intervalo_ativo SET DEFAULT FALSE,
  ALTER COLUMN intervalo_ativo SET NOT NULL;

ALTER TABLE public.horario_funcionamento
  DROP CONSTRAINT IF EXISTS intervalo_funcionamento_valido;

ALTER TABLE public.horario_funcionamento
  ADD CONSTRAINT intervalo_funcionamento_valido CHECK (
    (intervalo_ativo = FALSE AND hora_inicio_intervalo IS NULL AND hora_fim_intervalo IS NULL)
    OR
    (intervalo_ativo = TRUE AND ativo = TRUE
      AND hora_inicio_intervalo IS NOT NULL AND hora_fim_intervalo IS NOT NULL
      AND hora_inicio_intervalo < hora_fim_intervalo
      AND hora_abertura <= hora_inicio_intervalo
      AND hora_fim_intervalo <= hora_fechamento)
  );

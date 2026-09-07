BEGIN;

-- A data pode ser removida da agenda sem apagar o histórico cancelado.
-- Agendamentos ativos continuam bloqueando a exclusão pela aplicação.
DO $$
DECLARE
  nome_constraint TEXT;
BEGIN
  SELECT c.conname INTO nome_constraint
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.agendamento'::regclass
    AND c.contype = 'f'
    AND a.attname = 'agenda_idagenda'
  LIMIT 1;

  IF nome_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.agendamento DROP CONSTRAINT %I', nome_constraint);
  END IF;
END $$;

ALTER TABLE public.agendamento
  ALTER COLUMN agenda_idagenda DROP NOT NULL;

ALTER TABLE public.agendamento
  ADD CONSTRAINT agendamento_agenda_idagenda_fkey
  FOREIGN KEY (agenda_idagenda)
  REFERENCES public.agenda(idagenda)
  ON DELETE SET NULL;

COMMIT;

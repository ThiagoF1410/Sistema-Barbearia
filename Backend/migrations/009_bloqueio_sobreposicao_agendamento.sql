BEGIN;

-- Impede intervalos sobrepostos para o mesmo profissional e data.
-- A trava transacional também protege contra duas reservas simultâneas.
CREATE OR REPLACE FUNCTION public.validar_sobreposicao_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  nova_duracao INTEGER;
BEGIN
  IF NEW.statusagendamento = 'CANCELADO' THEN
    RETURN NEW;
  END IF;

  SELECT duracao INTO nova_duracao
  FROM public.servico
  WHERE idservico = NEW.servico_idservico;

  IF nova_duracao IS NULL OR nova_duracao <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'O serviço deve possuir uma duração válida.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    NEW.profissional_idprofissional,
    hashtext(NEW.dataagendamento::TEXT)
  );

  IF EXISTS (
    SELECT 1
    FROM public.agendamento a
    JOIN public.servico s ON s.idservico = a.servico_idservico
    WHERE a.profissional_idprofissional = NEW.profissional_idprofissional
      AND a.dataagendamento = NEW.dataagendamento
      AND a.statusagendamento <> 'CANCELADO'
      AND a.idagendamento <> COALESCE(NEW.idagendamento, 0)
      AND a.horario < (NEW.horario + (nova_duracao * INTERVAL '1 minute'))
      AND (a.horario + (s.duracao * INTERVAL '1 minute')) > NEW.horario
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'O horário conflita com outro atendimento deste profissional.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_sobreposicao_agendamento
  ON public.agendamento;

CREATE TRIGGER trg_validar_sobreposicao_agendamento
BEFORE INSERT OR UPDATE OF profissional_idprofissional, dataagendamento, horario,
  servico_idservico, statusagendamento
ON public.agendamento
FOR EACH ROW
EXECUTE FUNCTION public.validar_sobreposicao_agendamento();

COMMIT;

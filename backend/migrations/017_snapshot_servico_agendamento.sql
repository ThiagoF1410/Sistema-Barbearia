BEGIN;

ALTER TABLE public.agendamento
  ADD COLUMN IF NOT EXISTS servico_nome_snapshot VARCHAR(100),
  ADD COLUMN IF NOT EXISTS duracao_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS valor_snapshot NUMERIC(10, 2);

UPDATE public.agendamento a
SET servico_nome_snapshot = COALESCE(a.servico_nome_snapshot, s.nome),
    duracao_snapshot = COALESCE(a.duracao_snapshot, s.duracao),
    valor_snapshot = COALESCE(a.valor_snapshot, s.preco)
FROM public.servico s
WHERE s.idservico = a.servico_idservico
  AND (a.servico_nome_snapshot IS NULL OR a.duracao_snapshot IS NULL OR a.valor_snapshot IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.agendamento
    WHERE servico_nome_snapshot IS NULL
       OR duracao_snapshot IS NULL
       OR duracao_snapshot <= 0
       OR valor_snapshot IS NULL
       OR valor_snapshot < 0
  ) THEN
    RAISE EXCEPTION 'Não foi possível criar o snapshot de todos os agendamentos.';
  END IF;
END
$$;

ALTER TABLE public.agendamento
  ALTER COLUMN servico_nome_snapshot SET NOT NULL,
  ALTER COLUMN duracao_snapshot SET NOT NULL,
  ALTER COLUMN valor_snapshot SET NOT NULL;

ALTER TABLE public.agendamento
  DROP CONSTRAINT IF EXISTS agendamento_duracao_snapshot_valida,
  DROP CONSTRAINT IF EXISTS agendamento_valor_snapshot_valido;

ALTER TABLE public.agendamento
  ADD CONSTRAINT agendamento_duracao_snapshot_valida CHECK (duracao_snapshot > 0),
  ADD CONSTRAINT agendamento_valor_snapshot_valido CHECK (valor_snapshot >= 0);

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

  nova_duracao := NEW.duracao_snapshot;
  IF nova_duracao IS NULL OR nova_duracao <= 0 THEN
    SELECT duracao INTO nova_duracao
    FROM public.servico
    WHERE idservico = NEW.servico_idservico;
  END IF;

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
      AND (a.horario + (COALESCE(a.duracao_snapshot, s.duracao) * INTERVAL '1 minute')) > NEW.horario
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
  servico_idservico, duracao_snapshot, statusagendamento
ON public.agendamento
FOR EACH ROW
EXECUTE FUNCTION public.validar_sobreposicao_agendamento();

CREATE OR REPLACE VIEW public.vw_agendamentos_completos AS
SELECT
  a.idagendamento,
  a.dataagendamento,
  a.horario,
  a.statusagendamento,
  c.idcliente,
  uc.idusuario AS cliente_usuario_id,
  uc.nome AS cliente,
  uc.email AS cliente_email,
  p.idprofissional,
  up.nome AS profissional,
  p.especialidade,
  s.idservico,
  a.servico_nome_snapshot AS servico,
  a.duracao_snapshot AS duracao,
  a.valor_snapshot AS preco
FROM public.agendamento a
JOIN public.cliente c ON c.idcliente = a.cliente_idcliente
JOIN public.usuario uc ON uc.idusuario = c.usuario_idusuario
JOIN public.profissional p ON p.idprofissional = a.profissional_idprofissional
JOIN public.usuario up ON up.idusuario = p.usuario_idusuario
JOIN public.servico s ON s.idservico = a.servico_idservico;

COMMIT;

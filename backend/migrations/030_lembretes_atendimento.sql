BEGIN;
ALTER TABLE public.cliente ADD COLUMN IF NOT EXISTS receber_lembretes_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.agendamento ADD COLUMN IF NOT EXISTS lembrete_reservado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.whatsapp_notificacao ADD COLUMN IF NOT EXISTS lembrete_inicio TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION public.atualizar_prazo_lembrete() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.dataagendamento IS DISTINCT FROM NEW.dataagendamento OR OLD.horario IS DISTINCT FROM NEW.horario THEN
    NEW.lembrete_reservado_em = NOW();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS atualizar_prazo_lembrete ON public.agendamento;
CREATE TRIGGER atualizar_prazo_lembrete BEFORE UPDATE OF dataagendamento, horario ON public.agendamento
FOR EACH ROW EXECUTE FUNCTION public.atualizar_prazo_lembrete();
COMMIT;

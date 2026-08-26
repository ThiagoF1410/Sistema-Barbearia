-- Padroniza os e-mails existentes e garante unicidade sem diferenciar maiúsculas.
DO $$
BEGIN
  IF EXISTS (
    SELECT LOWER(BTRIM(email))
    FROM public.usuario
    GROUP BY LOWER(BTRIM(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem e-mails duplicados quando ignoradas maiúsculas e espaços. Corrija-os antes de aplicar a migração 010.';
  END IF;
END $$;

UPDATE public.usuario
SET email = LOWER(BTRIM(email))
WHERE email IS DISTINCT FROM LOWER(BTRIM(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email_normalizado
  ON public.usuario (LOWER(BTRIM(email)));

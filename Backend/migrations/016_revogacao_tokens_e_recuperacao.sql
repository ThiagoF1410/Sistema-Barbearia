BEGIN;

ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS token_version INTEGER;

UPDATE public.usuario
SET token_version = 0
WHERE token_version IS NULL;

ALTER TABLE public.usuario
  ALTER COLUMN token_version SET DEFAULT 0,
  ALTER COLUMN token_version SET NOT NULL;

ALTER TABLE public.usuario
  DROP CONSTRAINT IF EXISTS usuario_token_version_valido;

ALTER TABLE public.usuario
  ADD CONSTRAINT usuario_token_version_valido
  CHECK (token_version >= 0);

-- Tabelas legadas usavam TIMESTAMP sem fuso. Os valores foram gerados pela
-- aplicação em horário local, por isso a conversão explicita São Paulo.
DO $$
DECLARE
  tipo_expiracao TEXT;
  tipo_criacao TEXT;
BEGIN
  SELECT data_type
  INTO tipo_expiracao
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'password_reset_tokens'
    AND column_name = 'expires_at';

  IF tipo_expiracao = 'timestamp without time zone' THEN
    ALTER TABLE public.password_reset_tokens
      ALTER COLUMN expires_at TYPE TIMESTAMPTZ
      USING expires_at AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  SELECT data_type
  INTO tipo_criacao
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'password_reset_tokens'
    AND column_name = 'created_at';

  IF tipo_criacao = 'timestamp without time zone' THEN
    ALTER TABLE public.password_reset_tokens
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING created_at AT TIME ZONE 'America/Sao_Paulo';
  END IF;
END
$$;

UPDATE public.password_reset_tokens
SET used = CASE
  WHEN token_hash IS NULL THEN TRUE
  ELSE COALESCE(used, FALSE)
END
WHERE token_hash IS NULL OR used IS NULL;

ALTER TABLE public.password_reset_tokens
  ALTER COLUMN used SET DEFAULT FALSE,
  ALTER COLUMN used SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Mantém apenas a solicitação ativa mais recente de cada usuário antes de
-- aplicar a unicidade. O lock no backend serializa novas solicitações.
WITH tokens_ativos AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY usuario_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS ordem
  FROM public.password_reset_tokens
  WHERE used = FALSE
)
UPDATE public.password_reset_tokens t
SET used = TRUE
FROM tokens_ativos a
WHERE t.id = a.id AND a.ordem > 1;

DROP INDEX IF EXISTS public.password_reset_tokens_usuario_ativo_uidx;

CREATE UNIQUE INDEX password_reset_tokens_usuario_ativo_uidx
  ON public.password_reset_tokens (usuario_id)
  WHERE used = FALSE;

ALTER TABLE public.password_reset_tokens
  DROP CONSTRAINT IF EXISTS password_reset_token_ativo_possui_hash;

ALTER TABLE public.password_reset_tokens
  ADD CONSTRAINT password_reset_token_ativo_possui_hash
  CHECK (used = TRUE OR token_hash IS NOT NULL);

-- O backend armazena apenas SHA-256. Remove o token em texto puro deixado pelo
-- esquema antigo e invalida os registros que não possuem hash.
ALTER TABLE public.password_reset_tokens
  DROP COLUMN IF EXISTS token;

COMMIT;

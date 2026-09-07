CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidade com a versão antiga, que armazenava o token em texto puro.
ALTER TABLE public.password_reset_tokens ADD COLUMN IF NOT EXISTS token_hash CHAR(64);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_tokens'
      AND column_name = 'token'
  ) THEN
    ALTER TABLE public.password_reset_tokens ALTER COLUMN token DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS password_reset_tokens_usuario_idx
  ON public.password_reset_tokens (usuario_id, used);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expira_idx
  ON public.password_reset_tokens (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_hash_idx
  ON public.password_reset_tokens (token_hash)
  WHERE token_hash IS NOT NULL;

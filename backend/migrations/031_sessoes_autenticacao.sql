BEGIN;

CREATE TABLE IF NOT EXISTS public.sessao_autenticacao (
  idsessao BIGSERIAL PRIMARY KEY,
  usuario_idusuario INTEGER NOT NULL
    REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
  perfil VARCHAR(20) NOT NULL
    CHECK (perfil IN ('cliente', 'profissional', 'admin')),
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_atividade_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL,
  revogada_em TIMESTAMPTZ,
  CHECK (expira_em > criada_em),
  CHECK (ultima_atividade_em >= criada_em)
);

CREATE INDEX IF NOT EXISTS idx_sessao_autenticacao_usuario_ativa
  ON public.sessao_autenticacao (usuario_idusuario, expira_em)
  WHERE revogada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessao_autenticacao_expiracao
  ON public.sessao_autenticacao (expira_em)
  WHERE revogada_em IS NULL;

COMMIT;

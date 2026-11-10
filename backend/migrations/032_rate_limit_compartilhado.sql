CREATE TABLE IF NOT EXISTS public.controle_taxa (
  chave CHAR(64) PRIMARY KEY,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  expira_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_controle_taxa_expiracao
  ON public.controle_taxa (expira_em);

COMMENT ON TABLE public.controle_taxa IS
  'Contadores compartilhados de limitacao de requisicoes entre instancias da API.';

BEGIN;

CREATE TABLE IF NOT EXISTS public.solicitacao_ausencia_profissional (
  idsolicitacao SERIAL PRIMARY KEY,
  profissional_idprofissional INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  datainicio DATE NOT NULL,
  datafim DATE NOT NULL,
  motivo VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  resposta_administrador VARCHAR(255),
  administrador_idadministrador INTEGER,
  disponibilidade_iddisponibilidade INTEGER,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  analisado_em TIMESTAMPTZ,

  CONSTRAINT solicitacao_ausencia_tipo_check
    CHECK (tipo IN ('FOLGA', 'FERIAS')),
  CONSTRAINT solicitacao_ausencia_status_check
    CHECK (status IN ('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA')),
  CONSTRAINT solicitacao_ausencia_datas_check
    CHECK (datafim >= datainicio),
  CONSTRAINT solicitacao_ausencia_profissional_fkey
    FOREIGN KEY (profissional_idprofissional)
    REFERENCES public.profissional(idprofissional)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT solicitacao_ausencia_administrador_fkey
    FOREIGN KEY (administrador_idadministrador)
    REFERENCES public.administrador(idadministrador)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT solicitacao_ausencia_disponibilidade_fkey
    FOREIGN KEY (disponibilidade_iddisponibilidade)
    REFERENCES public.disponibilidade(iddisponibilidade)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS solicitacao_ausencia_profissional_status_idx
  ON public.solicitacao_ausencia_profissional
  (profissional_idprofissional, status, datainicio DESC);

CREATE INDEX IF NOT EXISTS solicitacao_ausencia_status_criacao_idx
  ON public.solicitacao_ausencia_profissional (status, criado_em DESC);

COMMIT;

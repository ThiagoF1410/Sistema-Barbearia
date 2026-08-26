BEGIN;

-- Pré-condições: a agenda individual parte dos profissionais e do horário
-- global já existentes. Qualquer falha desfaz integralmente esta migração.
DO $$
DECLARE
  total_dias INTEGER;
  colunas_globais INTEGER;
BEGIN
  IF TO_REGCLASS('public.profissional') IS NULL THEN
    RAISE EXCEPTION
      'A tabela public.profissional não existe. Execute a migração base antes da 015.';
  END IF;

  IF TO_REGCLASS('public.horario_funcionamento') IS NULL THEN
    RAISE EXCEPTION
      'A tabela public.horario_funcionamento não existe. Execute as migrações 002 e 005 antes da 015.';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO colunas_globais
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'horario_funcionamento'
    AND column_name IN (
      'dia_semana', 'hora_abertura', 'hora_fechamento', 'ativo',
      'intervalo_ativo', 'hora_inicio_intervalo', 'hora_fim_intervalo'
    );

  IF colunas_globais <> 7 THEN
    RAISE EXCEPTION
      'A tabela horario_funcionamento não possui todas as colunas esperadas. Execute as migrações 002 e 005.';
  END IF;

  SELECT COUNT(DISTINCT dia_semana)::INTEGER
  INTO total_dias
  FROM public.horario_funcionamento
  WHERE dia_semana BETWEEN 0 AND 6;

  IF total_dias <> 7 THEN
    RAISE EXCEPTION
      'O horário global deve possuir os sete dias da semana antes de criar expedientes individuais.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.horario_funcionamento
    WHERE ativo IS NULL
       OR intervalo_ativo IS NULL
       OR NOT (
      (
        ativo = FALSE
        AND hora_abertura IS NULL
        AND hora_fechamento IS NULL
        AND intervalo_ativo = FALSE
        AND hora_inicio_intervalo IS NULL
        AND hora_fim_intervalo IS NULL
      )
      OR
      (
        ativo = TRUE
        AND hora_abertura IS NOT NULL
        AND hora_fechamento IS NOT NULL
        AND hora_abertura < hora_fechamento
        AND (
          (
            intervalo_ativo = FALSE
            AND hora_inicio_intervalo IS NULL
            AND hora_fim_intervalo IS NULL
          )
          OR
          (
            intervalo_ativo = TRUE
            AND hora_inicio_intervalo IS NOT NULL
            AND hora_fim_intervalo IS NOT NULL
            AND hora_inicio_intervalo < hora_fim_intervalo
            AND hora_abertura <= hora_inicio_intervalo
            AND hora_fim_intervalo <= hora_fechamento
          )
        )
      )
    )
  ) THEN
    RAISE EXCEPTION
      'Existem horários globais inválidos. Corrija-os antes de aplicar a migração 015.';
  END IF;
END
$$;

ALTER TABLE public.horario_funcionamento
  ALTER COLUMN intervalo_ativo SET DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.horario_profissional (
  idhorario_profissional SERIAL PRIMARY KEY,
  profissional_idprofissional INTEGER NOT NULL,
  dia_semana SMALLINT NOT NULL,
  hora_abertura TIME,
  hora_fechamento TIME,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  intervalo_ativo BOOLEAN NOT NULL DEFAULT FALSE,
  hora_inicio_intervalo TIME,
  hora_fim_intervalo TIME,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT horario_profissional_profissional_fkey
    FOREIGN KEY (profissional_idprofissional)
    REFERENCES public.profissional(idprofissional)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT horario_profissional_dia_semana_valido
    CHECK (dia_semana BETWEEN 0 AND 6),

  CONSTRAINT horario_profissional_expediente_valido
    CHECK (
      (
        ativo = FALSE
        AND hora_abertura IS NULL
        AND hora_fechamento IS NULL
      )
      OR
      (
        ativo = TRUE
        AND hora_abertura IS NOT NULL
        AND hora_fechamento IS NOT NULL
        AND hora_abertura < hora_fechamento
      )
    ),

  CONSTRAINT horario_profissional_intervalo_valido
    CHECK (
      (
        intervalo_ativo = FALSE
        AND hora_inicio_intervalo IS NULL
        AND hora_fim_intervalo IS NULL
      )
      OR
      (
        intervalo_ativo = TRUE
        AND ativo = TRUE
        AND hora_inicio_intervalo IS NOT NULL
        AND hora_fim_intervalo IS NOT NULL
        AND hora_inicio_intervalo < hora_fim_intervalo
        AND hora_abertura <= hora_inicio_intervalo
        AND hora_fim_intervalo <= hora_fechamento
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS horario_profissional_profissional_dia_uidx
  ON public.horario_profissional
    (profissional_idprofissional, dia_semana);

CREATE INDEX IF NOT EXISTS horario_profissional_dia_ativo_idx
  ON public.horario_profissional (dia_semana, profissional_idprofissional)
  WHERE ativo = TRUE;

-- Enquanto não houver uma linha personalizada, o backend usa o expediente
-- global. Assim, alterações globais continuam alcançando profissionais que
-- ainda não receberam uma escala própria.

-- A tabela já existe no esquema legado. CREATE IF NOT EXISTS também permite
-- instalar a aplicação em uma base que ainda não a possua.
CREATE TABLE IF NOT EXISTS public.disponibilidade (
  iddisponibilidade SERIAL PRIMARY KEY,
  profissional_idprofissional INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  datainicio DATE NOT NULL,
  datafim DATE NOT NULL,
  descricao VARCHAR(255),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT disponibilidade_profissional_fkey
    FOREIGN KEY (profissional_idprofissional)
    REFERENCES public.profissional(idprofissional)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT disponibilidade_tipo_valido
    CHECK (tipo IN ('FOLGA', 'FERIAS', 'FERIADO')),

  CONSTRAINT disponibilidade_periodo_valido
    CHECK (datafim >= datainicio)
);

DO $$
DECLARE
  colunas_base INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO colunas_base
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'disponibilidade'
    AND column_name IN (
      'iddisponibilidade', 'profissional_idprofissional', 'tipo',
      'datainicio', 'datafim', 'descricao'
    );

  IF colunas_base <> 6 THEN
    RAISE EXCEPTION
      'A tabela disponibilidade possui uma estrutura legada incompatível com a migração 015.';
  END IF;
END
$$;

ALTER TABLE public.disponibilidade
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;

-- Remove somente CHECK constraints relacionadas ao tipo ou ao período para
-- consolidá-las com nomes e regras canônicas.
DO $$
DECLARE
  restricao RECORD;
BEGIN
  FOR restricao IN
    SELECT DISTINCT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.disponibilidade'::regclass
      AND c.contype = 'c'
      AND a.attname IN ('tipo', 'datainicio', 'datafim')
  LOOP
    EXECUTE FORMAT(
      'ALTER TABLE public.disponibilidade DROP CONSTRAINT %I',
      restricao.conname
    );
  END LOOP;
END
$$;

-- Rejeita dados ambíguos em vez de descartá-los ou corrigi-los silenciosamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.disponibilidade
    WHERE profissional_idprofissional IS NULL
       OR tipo IS NULL
       OR UPPER(BTRIM(tipo::TEXT)) NOT IN ('FOLGA', 'FERIAS', 'FERIADO')
       OR datainicio IS NULL
       OR datafim IS NULL
       OR datafim < datainicio
  ) THEN
    RAISE EXCEPTION
      'Existem disponibilidades inválidas. Corrija profissional, tipo ou período antes de aplicar a migração 015.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.disponibilidade d
    LEFT JOIN public.profissional p
      ON p.idprofissional = d.profissional_idprofissional
    WHERE p.idprofissional IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existem disponibilidades vinculadas a profissionais inexistentes.';
  END IF;
END
$$;

UPDATE public.disponibilidade
SET tipo = UPPER(BTRIM(tipo::TEXT)),
    criado_em = COALESCE(criado_em, NOW()),
    atualizado_em = COALESCE(atualizado_em, NOW());

ALTER TABLE public.disponibilidade
  ALTER COLUMN profissional_idprofissional SET NOT NULL,
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN datainicio SET NOT NULL,
  ALTER COLUMN datafim SET NOT NULL,
  ALTER COLUMN criado_em SET DEFAULT NOW(),
  ALTER COLUMN criado_em SET NOT NULL,
  ALTER COLUMN atualizado_em SET DEFAULT NOW(),
  ALTER COLUMN atualizado_em SET NOT NULL;

ALTER TABLE public.disponibilidade
  ADD CONSTRAINT disponibilidade_tipo_valido
    CHECK (tipo IN ('FOLGA', 'FERIAS', 'FERIADO'))
    NOT VALID,
  ADD CONSTRAINT disponibilidade_periodo_valido
    CHECK (datafim >= datainicio)
    NOT VALID;

ALTER TABLE public.disponibilidade
  VALIDATE CONSTRAINT disponibilidade_tipo_valido;

ALTER TABLE public.disponibilidade
  VALIDATE CONSTRAINT disponibilidade_periodo_valido;

-- Adiciona a FK apenas se nenhuma FK equivalente já existir. Assim, a
-- constraint legada fk_disponibilidade_profissional é preservada sem duplicação.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.disponibilidade'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.profissional'::regclass
      AND a.attname = 'profissional_idprofissional'
  ) THEN
    ALTER TABLE public.disponibilidade
      ADD CONSTRAINT disponibilidade_profissional_fkey
      FOREIGN KEY (profissional_idprofissional)
      REFERENCES public.profissional(idprofissional)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS disponibilidade_profissional_periodo_idx
  ON public.disponibilidade
    (profissional_idprofissional, datainicio, datafim);

CREATE INDEX IF NOT EXISTS disponibilidade_periodo_idx
  ON public.disponibilidade (datainicio, datafim);

CREATE INDEX IF NOT EXISTS disponibilidade_tipo_idx
  ON public.disponibilidade (tipo);

-- Pós-condições: nenhuma indisponibilidade pode permanecer inválida.
DO $$
DECLARE
  total_checks_disponibilidade INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.disponibilidade
    WHERE tipo NOT IN ('FOLGA', 'FERIAS', 'FERIADO')
       OR datafim < datainicio
  ) THEN
    RAISE EXCEPTION
      'A consolidação da disponibilidade individual não foi concluída.';
  END IF;

  SELECT COUNT(DISTINCT c.conname)::INTEGER
  INTO total_checks_disponibilidade
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.disponibilidade'::regclass
    AND c.contype = 'c'
    AND a.attname IN ('tipo', 'datainicio', 'datafim');

  IF total_checks_disponibilidade <> 2 THEN
    RAISE EXCEPTION
      'Eram esperadas duas CHECK constraints canônicas em disponibilidade; encontradas: %.',
      total_checks_disponibilidade;
  END IF;
END
$$;

COMMIT;

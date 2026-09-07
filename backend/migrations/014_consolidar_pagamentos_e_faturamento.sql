BEGIN;

-- Esta migração corrige estruturas legadas da tabela pagamento sem apagar
-- registros. Qualquer inconsistência interrompe a execução e desfaz tudo.
DO $$
BEGIN
  IF TO_REGCLASS('public.pagamento') IS NULL THEN
    RAISE EXCEPTION
      'A tabela public.pagamento não existe. Execute as migrações anteriores antes da 014.';
  END IF;

  IF TO_REGCLASS('public.agendamento') IS NULL THEN
    RAISE EXCEPTION
      'A tabela public.agendamento não existe. Execute a migração base antes da 014.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagamento'
      AND column_name = 'agendamento_idagendamento'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagamento'
      AND column_name = 'valor'
  ) THEN
    RAISE EXCEPTION
      'A tabela public.pagamento não possui as colunas base esperadas.';
  END IF;
END
$$;

ALTER TABLE public.pagamento
  ADD COLUMN IF NOT EXISTS datapagamento DATE,
  ADD COLUMN IF NOT EXISTS statuspagamento VARCHAR(20),
  ADD COLUMN IF NOT EXISTS metodo VARCHAR(30),
  ADD COLUMN IF NOT EXISTS moeda CHAR(3),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;

-- Remove todas as CHECK constraints que envolvem statuspagamento. Isso inclui
-- tanto chk_status_pagamento (legada: PENDENTE/PAGO) quanto constraints criadas
-- pelas migrações mais recentes. Uma única constraint canônica será recriada.
DO $$
DECLARE
  restricao RECORD;
BEGIN
  FOR restricao IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.pagamento'::regclass
      AND c.contype = 'c'
      AND a.attname = 'statuspagamento'
  LOOP
    EXECUTE FORMAT(
      'ALTER TABLE public.pagamento DROP CONSTRAINT %I',
      restricao.conname
    );
  END LOOP;
END
$$;

-- Compatibilidade adicional com versões que possuíam a coluna duplicada
-- "status". Valores mais informativos são preservados antes de removê-la.
DO $$
DECLARE
  status_legado_invalido BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pagamento'
      AND column_name = 'status'
  ) THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM public.pagamento
        WHERE status IS NOT NULL
          AND UPPER(BTRIM(status::TEXT)) NOT IN
            ('PENDENTE', 'PAGO', 'CONFIRMADO', 'CANCELADO', 'FALHOU')
      )
    $sql$
    INTO status_legado_invalido;

    IF status_legado_invalido THEN
      RAISE EXCEPTION
        'Existem valores desconhecidos na coluna legada pagamento.status. Corrija-os antes de aplicar a migração 014.';
    END IF;

    EXECUTE $sql$
      UPDATE public.pagamento
      SET statuspagamento = CASE UPPER(BTRIM(status::TEXT))
        WHEN 'PAGO' THEN 'CONFIRMADO'
        WHEN 'CONFIRMADO' THEN 'CONFIRMADO'
        WHEN 'CANCELADO' THEN 'CANCELADO'
        WHEN 'FALHOU' THEN 'FALHOU'
        ELSE 'PENDENTE'
      END
      WHERE status IS NOT NULL
        AND (
          statuspagamento IS NULL
          OR (
            UPPER(BTRIM(statuspagamento::TEXT)) = 'PENDENTE'
            AND UPPER(BTRIM(status::TEXT)) IN
              ('PAGO', 'CONFIRMADO', 'CANCELADO', 'FALHOU')
          )
        )
    $sql$;
  END IF;
END
$$;

-- Não transforma silenciosamente um estado desconhecido em PENDENTE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.pagamento
    WHERE statuspagamento IS NOT NULL
      AND UPPER(BTRIM(statuspagamento::TEXT)) NOT IN
        ('PENDENTE', 'PAGO', 'CONFIRMADO', 'CANCELADO', 'FALHOU')
  ) THEN
    RAISE EXCEPTION
      'Existem valores desconhecidos em pagamento.statuspagamento. Corrija-os antes de aplicar a migração 014.';
  END IF;
END
$$;

UPDATE public.pagamento
SET statuspagamento = CASE UPPER(BTRIM(statuspagamento::TEXT))
      WHEN 'PAGO' THEN 'CONFIRMADO'
      WHEN 'CONFIRMADO' THEN 'CONFIRMADO'
      WHEN 'CANCELADO' THEN 'CANCELADO'
      WHEN 'FALHOU' THEN 'FALHOU'
      ELSE 'PENDENTE'
    END,
    datapagamento = COALESCE(
      datapagamento,
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE
    ),
    metodo = CASE
      WHEN metodo IS NULL OR BTRIM(metodo) = '' THEN 'STRIPE'
      ELSE UPPER(BTRIM(metodo))
    END,
    moeda = CASE
      WHEN moeda IS NULL OR BTRIM(moeda) = '' THEN 'brl'
      ELSE LOWER(BTRIM(moeda))
    END,
    criado_em = COALESCE(criado_em, NOW()),
    atualizado_em = COALESCE(atualizado_em, NOW());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.pagamento
    WHERE CHAR_LENGTH(BTRIM(moeda)) <> 3
  ) THEN
    RAISE EXCEPTION
      'Existem moedas inválidas em public.pagamento; o código ISO deve possuir 3 caracteres.';
  END IF;
END
$$;

ALTER TABLE public.pagamento
  ALTER COLUMN datapagamento SET DEFAULT
    ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE),
  ALTER COLUMN datapagamento SET NOT NULL,
  ALTER COLUMN statuspagamento SET DEFAULT 'PENDENTE',
  ALTER COLUMN statuspagamento SET NOT NULL,
  ALTER COLUMN metodo SET DEFAULT 'STRIPE',
  ALTER COLUMN metodo SET NOT NULL,
  ALTER COLUMN moeda SET DEFAULT 'brl',
  ALTER COLUMN moeda SET NOT NULL,
  ALTER COLUMN criado_em SET DEFAULT NOW(),
  ALTER COLUMN criado_em SET NOT NULL,
  ALTER COLUMN atualizado_em SET DEFAULT NOW(),
  ALTER COLUMN atualizado_em SET NOT NULL;

ALTER TABLE public.pagamento
  DROP COLUMN IF EXISTS status;

ALTER TABLE public.pagamento
  ADD CONSTRAINT pagamento_statuspagamento_valido
  CHECK (statuspagamento IN ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU'))
  NOT VALID;

ALTER TABLE public.pagamento
  VALIDATE CONSTRAINT pagamento_statuspagamento_valido;

-- Pagamentos fazem parte do histórico financeiro e não devem desaparecer
-- silenciosamente ao excluir um agendamento. Consolida a FK como RESTRICT.
DO $$
DECLARE
  restricao RECORD;
BEGIN
  FOR restricao IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.pagamento'::regclass
      AND c.contype = 'f'
      AND a.attname = 'agendamento_idagendamento'
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.pagamento DROP CONSTRAINT %I', restricao.conname);
  END LOOP;

  ALTER TABLE public.pagamento
    ADD CONSTRAINT pagamento_agendamento_fkey
    FOREIGN KEY (agendamento_idagendamento)
    REFERENCES public.agendamento(idagendamento)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
END
$$;

-- Mantém as mesmas colunas da view legada e troca apenas a regra de pagamento
-- concluído: o estado canônico agora é CONFIRMADO, não PAGO.
CREATE OR REPLACE VIEW public.vw_faturamento_mensal AS
SELECT
  EXTRACT(YEAR FROM ag.dataagendamento) AS ano,
  EXTRACT(MONTH FROM ag.dataagendamento) AS mes,
  COUNT(ag.idagendamento) AS total_atendimentos,
  COALESCE(SUM(pg.valor), 0::NUMERIC) AS faturamento_total
FROM public.agendamento ag
LEFT JOIN public.pagamento pg
  ON pg.agendamento_idagendamento = ag.idagendamento
 AND pg.statuspagamento = 'CONFIRMADO'
WHERE ag.statusagendamento = 'CONCLUIDO'
GROUP BY
  EXTRACT(YEAR FROM ag.dataagendamento),
  EXTRACT(MONTH FROM ag.dataagendamento)
ORDER BY
  EXTRACT(YEAR FROM ag.dataagendamento) DESC,
  EXTRACT(MONTH FROM ag.dataagendamento) DESC;

-- Pós-condições: se alguma delas falhar, o COMMIT não é alcançado.
DO $$
DECLARE
  total_constraints_status INTEGER;
  definicao_view TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.pagamento
    WHERE statuspagamento = 'PAGO'
       OR statuspagamento NOT IN
          ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU')
  ) THEN
    RAISE EXCEPTION
      'A consolidação dos status de pagamento não foi concluída.';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO total_constraints_status
  FROM pg_constraint c
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.pagamento'::regclass
    AND c.contype = 'c'
    AND a.attname = 'statuspagamento';

  IF total_constraints_status <> 1 THEN
    RAISE EXCEPTION
      'Era esperada exatamente uma CHECK constraint para statuspagamento; encontradas: %.',
      total_constraints_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.pagamento'::regclass
      AND conname = 'pagamento_agendamento_fkey'
      AND contype = 'f'
      AND confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION
      'A FK de pagamento deve preservar o histórico com ON DELETE RESTRICT.';
  END IF;

  SELECT PG_GET_VIEWDEF('public.vw_faturamento_mensal'::regclass, TRUE)
  INTO definicao_view;

  IF POSITION('CONFIRMADO' IN UPPER(definicao_view)) = 0
     OR POSITION('PAGO' IN UPPER(definicao_view)) > 0 THEN
    RAISE EXCEPTION
      'A view vw_faturamento_mensal ainda não utiliza exclusivamente o status CONFIRMADO.';
  END IF;
END
$$;

COMMIT;

BEGIN;

-- Esquema mínimo reproduzível da aplicação. Esta baseline deve ser executada
-- somente antes das migrações numeradas de 001 em diante.

CREATE TABLE IF NOT EXISTS public.usuario (
  idusuario SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  senha VARCHAR(255) NOT NULL,

  CONSTRAINT usuario_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public.cliente (
  idcliente SERIAL PRIMARY KEY,
  usuario_idusuario INTEGER NOT NULL,
  telefone VARCHAR(20) NOT NULL,

  CONSTRAINT cliente_usuario_key UNIQUE (usuario_idusuario),
  CONSTRAINT fk_cliente_usuario
    FOREIGN KEY (usuario_idusuario)
    REFERENCES public.usuario(idusuario)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.administrador (
  idadministrador SERIAL PRIMARY KEY,
  usuario_idusuario INTEGER NOT NULL,

  CONSTRAINT administrador_usuario_key UNIQUE (usuario_idusuario),
  CONSTRAINT fk_administrador_usuario
    FOREIGN KEY (usuario_idusuario)
    REFERENCES public.usuario(idusuario)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.profissional (
  idprofissional SERIAL PRIMARY KEY,
  usuario_idusuario INTEGER NOT NULL,
  especialidade VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT profissional_usuario_key UNIQUE (usuario_idusuario),
  CONSTRAINT fk_profissional_usuario
    FOREIGN KEY (usuario_idusuario)
    REFERENCES public.usuario(idusuario)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.servico (
  idservico SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  duracao INTEGER NOT NULL,
  preco NUMERIC(10, 2) NOT NULL,
  descricao VARCHAR(255),

  CONSTRAINT chk_servico_tipo
    CHECK (tipo IN ('servico', 'produto')),
  CONSTRAINT chk_servico_duracao
    CHECK (duracao > 0),
  CONSTRAINT chk_servico_preco
    CHECK (preco >= 0)
);

-- A estrutura inicial corresponde à migração 002. A migração 005 adicionará
-- o intervalo global de almoço antes da criação dos horários individuais.
CREATE TABLE IF NOT EXISTS public.horario_funcionamento (
  idhorario SERIAL PRIMARY KEY,
  dia_semana SMALLINT NOT NULL,
  hora_abertura TIME,
  hora_fechamento TIME,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT horario_funcionamento_dia_semana_key UNIQUE (dia_semana),
  CONSTRAINT horario_funcionamento_dia_semana_check
    CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT horario_valido
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
    )
);

INSERT INTO public.horario_funcionamento
  (dia_semana, hora_abertura, hora_fechamento, ativo)
VALUES
  (0, NULL, NULL, FALSE),
  (1, '09:00', '19:30', TRUE),
  (2, '09:00', '19:30', TRUE),
  (3, '09:00', '19:30', TRUE),
  (4, '09:00', '19:30', TRUE),
  (5, '09:00', '19:30', TRUE),
  (6, '08:00', '15:00', TRUE)
ON CONFLICT (dia_semana) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.agenda (
  idagenda SERIAL PRIMARY KEY,
  data DATE NOT NULL,
  disponivel BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT agenda_data_key UNIQUE (data)
);

-- agenda_idagenda começa obrigatório para reproduzir o esquema anterior. A
-- migração 008 o torna opcional e troca a FK por ON DELETE SET NULL.
CREATE TABLE IF NOT EXISTS public.agendamento (
  idagendamento SERIAL PRIMARY KEY,
  agenda_idagenda INTEGER NOT NULL,
  cliente_idcliente INTEGER NOT NULL,
  profissional_idprofissional INTEGER NOT NULL,
  servico_idservico INTEGER NOT NULL,
  dataagendamento DATE NOT NULL,
  horario TIME NOT NULL,
  statusagendamento VARCHAR(20) NOT NULL DEFAULT 'AGENDADO',

  CONSTRAINT chk_status_agendamento
    CHECK (statusagendamento IN ('AGENDADO', 'CONCLUIDO', 'CANCELADO')),
  CONSTRAINT fk_agendamento_agenda
    FOREIGN KEY (agenda_idagenda)
    REFERENCES public.agenda(idagenda)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_agendamento_cliente
    FOREIGN KEY (cliente_idcliente)
    REFERENCES public.cliente(idcliente)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_agendamento_profissional
    FOREIGN KEY (profissional_idprofissional)
    REFERENCES public.profissional(idprofissional)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_agendamento_servico
    FOREIGN KEY (servico_idservico)
    REFERENCES public.servico(idservico)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_agendamento_cliente
  ON public.agendamento (cliente_idcliente);

CREATE INDEX IF NOT EXISTS idx_agendamento_profissional
  ON public.agendamento (profissional_idprofissional);

CREATE INDEX IF NOT EXISTS idx_agendamento_data
  ON public.agendamento (dataagendamento);

-- Registra folgas, férias e feriados próprios de cada profissional. A
-- migração 015 acrescentará timestamps, índices e constraints canônicas.
CREATE TABLE IF NOT EXISTS public.disponibilidade (
  iddisponibilidade SERIAL PRIMARY KEY,
  profissional_idprofissional INTEGER NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  datainicio DATE NOT NULL,
  datafim DATE NOT NULL,
  descricao VARCHAR(255),

  CONSTRAINT chk_disponibilidade_tipo
    CHECK (tipo IN ('FERIADO', 'FOLGA', 'FERIAS')),
  CONSTRAINT chk_disponibilidade_datas
    CHECK (datafim >= datainicio),
  CONSTRAINT fk_disponibilidade_profissional
    FOREIGN KEY (profissional_idprofissional)
    REFERENCES public.profissional(idprofissional)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- Mantém o artefato de relatório presente no modelo conceitual. Os relatórios
-- calculados pela aplicação usam a view criada na migração 014.
CREATE TABLE IF NOT EXISTS public.relatorio (
  idrelatorio SERIAL PRIMARY KEY,
  administrador_idadministrador INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  totalatendimentos INTEGER NOT NULL DEFAULT 0,
  faturamento NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

  CONSTRAINT chk_relatorio_mes CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT chk_relatorio_ano CHECK (ano >= 2000),
  CONSTRAINT chk_relatorio_total CHECK (totalatendimentos >= 0),
  CONSTRAINT chk_relatorio_faturamento CHECK (faturamento >= 0),
  CONSTRAINT relatorio_administrador_periodo_key
    UNIQUE (administrador_idadministrador, ano, mes),
  CONSTRAINT fk_relatorio_administrador
    FOREIGN KEY (administrador_idadministrador)
    REFERENCES public.administrador(idadministrador)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_relatorio_periodo
  ON public.relatorio (ano, mes);

-- Auditoria básica das operações de agendamento. usuario_id é anulável para
-- que o histórico possa ser preservado caso um usuário seja removido.
CREATE TABLE IF NOT EXISTS public.log_operacoes (
  idlog SERIAL PRIMARY KEY,
  usuario_id INTEGER,
  tabela VARCHAR(50) NOT NULL,
  operacao VARCHAR(50) NOT NULL,
  descricao TEXT,
  datahora TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT log_operacoes_usuario_fkey
    FOREIGN KEY (usuario_id)
    REFERENCES public.usuario(idusuario)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_log_operacoes_usuario_data
  ON public.log_operacoes (usuario_id, datahora DESC);

CREATE INDEX IF NOT EXISTS idx_log_operacoes_data
  ON public.log_operacoes (datahora DESC);

CREATE OR REPLACE FUNCTION public.fn_log_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  usuario_cliente INTEGER;
BEGIN
  SELECT c.usuario_idusuario
  INTO usuario_cliente
  FROM public.cliente c
  WHERE c.idcliente = NEW.cliente_idcliente;

  INSERT INTO public.log_operacoes (
    usuario_id,
    tabela,
    operacao,
    descricao
  )
  VALUES (
    usuario_cliente,
    'agendamento',
    'INSERT',
    'Novo agendamento realizado'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agendamento
  ON public.agendamento;

CREATE TRIGGER trg_log_agendamento
AFTER INSERT ON public.agendamento
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_agendamento();

COMMIT;

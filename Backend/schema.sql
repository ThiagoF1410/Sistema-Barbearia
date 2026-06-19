-- Script de criação do esquema para o sistema de barbearia

CREATE TABLE IF NOT EXISTS public.usuario (
  idusuario SERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cliente (
  idcliente SERIAL PRIMARY KEY,
  usuario_idusuario INTEGER NOT NULL REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
  telefone VARCHAR(20) NOT NULL,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.servico (
  idservico SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER NOT NULL,
  preco NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.agendamento (
  idagendamento SERIAL PRIMARY KEY,
  cliente_idcliente INTEGER NOT NULL REFERENCES public.cliente(idcliente) ON DELETE CASCADE,
  servico_idservico INTEGER NOT NULL REFERENCES public.servico(idservico),
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pagamento (
  idpagamento SERIAL PRIMARY KEY,
  agendamento_idagendamento INTEGER NOT NULL REFERENCES public.agendamento(idagendamento) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  forma_pagamento VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.log_auditoria (
  idlog SERIAL PRIMARY KEY,
  usuario_idusuario INTEGER REFERENCES public.usuario(idusuario),
  evento VARCHAR(255) NOT NULL,
  detalhes JSONB,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_usuario_email ON public.usuario(email);
CREATE INDEX IF NOT EXISTS idx_agendamento_data_hora ON public.agendamento(data_hora);
CREATE INDEX IF NOT EXISTS idx_pagamento_status ON public.pagamento(status);

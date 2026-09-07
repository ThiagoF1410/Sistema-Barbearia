BEGIN;

-- Amplia o catálogo sem duplicar itens já cadastrados.
-- Produtos não ocupam horário; serviços mantêm duração em minutos.
WITH catalogo(nome, tipo, duracao, preco, descricao) AS (
  VALUES
    ('Corte social', 'servico', 30, 30.00, 'Corte clássico alinhado, com acabamento à escolha.'),
    ('Corte americano', 'servico', 45, 35.00, 'Degradê americano com acabamento detalhado.'),
    ('Corte moicano', 'servico', 45, 35.00, 'Moicano moderno com laterais personalizadas.'),
    ('Corte infantil', 'servico', 30, 28.00, 'Corte pensado para crianças, com acabamento suave.'),
    ('Barba premium', 'servico', 45, 40.00, 'Toalha quente, modelagem, hidratação e acabamento da barba.'),
    ('Sobrancelha', 'servico', 15, 15.00, 'Limpeza e alinhamento da sobrancelha.'),
    ('Hidratação capilar', 'servico', 45, 45.00, 'Tratamento hidratante para recuperar maciez e brilho.'),
    ('Pigmentação capilar', 'servico', 45, 50.00, 'Aplicação de pigmentação para uniformizar o visual.'),
    ('Pó texturizador', 'produto', 1, 40.00, 'Pó de volume e textura com efeito natural.'),
    ('Spray fixador', 'produto', 1, 38.00, 'Spray de fixação para finalizar o penteado.'),
    ('Gel modelador', 'produto', 1, 25.00, 'Gel de fixação para modelagem do dia a dia.'),
    ('Condicionador hidratante', 'produto', 1, 30.00, 'Condicionador para maciez e hidratação dos fios.'),
    ('Shampoo anticaspa', 'produto', 1, 35.00, 'Shampoo de limpeza e cuidado diário do couro cabeludo.'),
    ('Escova para barba', 'produto', 1, 22.00, 'Escova compacta para alinhar e cuidar da barba.'),
    ('Kit cuidados para barba', 'produto', 1, 75.00, 'Kit com óleo, balm e escova para rotina completa.')
), atualizados AS (
  UPDATE public.servico servico
  SET duracao = catalogo.duracao,
      preco = catalogo.preco,
      descricao = catalogo.descricao
  FROM catalogo
  WHERE servico.tipo = catalogo.tipo
    AND LOWER(BTRIM(servico.nome)) = LOWER(catalogo.nome)
  RETURNING servico.idservico
)
INSERT INTO public.servico (nome, tipo, duracao, preco, descricao)
SELECT catalogo.nome, catalogo.tipo, catalogo.duracao, catalogo.preco, catalogo.descricao
FROM catalogo
WHERE NOT EXISTS (
  SELECT 1
  FROM public.servico existente
  WHERE existente.tipo = catalogo.tipo
    AND LOWER(BTRIM(existente.nome)) = LOWER(catalogo.nome)
);

COMMIT;

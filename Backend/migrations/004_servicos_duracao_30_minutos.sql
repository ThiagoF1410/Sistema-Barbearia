-- Ajusta apenas os serviços que ainda usam a duração anterior de 35 minutos.
-- Produtos e serviços com outras durações não são alterados.
UPDATE public.servico
SET duracao = 30
WHERE tipo = 'servico'
  AND duracao = 35;

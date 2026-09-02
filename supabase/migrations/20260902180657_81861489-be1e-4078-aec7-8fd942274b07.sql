ALTER TABLE public.vendas_produto DROP CONSTRAINT IF EXISTS vendas_produto_cliente_id_empresa_id_marketplace_mes_sku_key;
ALTER TABLE public.vendas_produto ADD COLUMN IF NOT EXISTS data_venda DATE;
ALTER TABLE public.vendas_produto ADD COLUMN IF NOT EXISTS estado TEXT;
CREATE INDEX IF NOT EXISTS vendas_produto_cliente_mes_idx ON public.vendas_produto (cliente_id, mes);
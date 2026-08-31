CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  aliquota_simples_padrao NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clientes" ON public.clientes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_cliente(_cliente_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = _cliente_id AND c.user_id = auth.uid())
$$;

CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own empresas" ON public.empresas FOR ALL TO authenticated USING (public.owns_cliente(cliente_id)) WITH CHECK (public.owns_cliente(cliente_id));

CREATE TABLE public.vendas_produto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL DEFAULT 'N/D',
  mes TEXT NOT NULL,
  sku TEXT NOT NULL,
  nome_produto TEXT NOT NULL DEFAULT '',
  fornecedor TEXT,
  unidades NUMERIC NOT NULL DEFAULT 0,
  receita NUMERIC NOT NULL DEFAULT 0,
  custo NUMERIC,
  tarifa_venda NUMERIC NOT NULL DEFAULT 0,
  tarifa_envio NUMERIC NOT NULL DEFAULT 0,
  receita_envio NUMERIC NOT NULL DEFAULT 0,
  cupom NUMERIC NOT NULL DEFAULT 0,
  comissao_afiliado NUMERIC NOT NULL DEFAULT 0,
  frete_entrega_direta NUMERIC NOT NULL DEFAULT 0,
  cancelamentos NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, empresa_id, marketplace, mes, sku)
);
CREATE INDEX vendas_produto_cliente_mes_idx ON public.vendas_produto (cliente_id, mes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_produto TO authenticated;
GRANT ALL ON public.vendas_produto TO service_role;
ALTER TABLE public.vendas_produto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vendas" ON public.vendas_produto FOR ALL TO authenticated USING (public.owns_cliente(cliente_id)) WITH CHECK (public.owns_cliente(cliente_id));

CREATE TABLE public.despesas_fixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas_fixas TO authenticated;
GRANT ALL ON public.despesas_fixas TO service_role;
ALTER TABLE public.despesas_fixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own despesas" ON public.despesas_fixas FOR ALL TO authenticated USING (public.owns_cliente(cliente_id)) WITH CHECK (public.owns_cliente(cliente_id));

CREATE TABLE public.parametros_mensais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  aliquota_simples_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametros_mensais TO authenticated;
GRANT ALL ON public.parametros_mensais TO service_role;
ALTER TABLE public.parametros_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own parametros" ON public.parametros_mensais FOR ALL TO authenticated USING (public.owns_cliente(cliente_id)) WITH CHECK (public.owns_cliente(cliente_id));
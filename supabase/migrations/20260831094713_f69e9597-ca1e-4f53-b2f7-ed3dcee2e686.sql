DROP POLICY "own empresas" ON public.empresas;
DROP POLICY "own vendas" ON public.vendas_produto;
DROP POLICY "own despesas" ON public.despesas_fixas;
DROP POLICY "own parametros" ON public.parametros_mensais;
DROP FUNCTION public.owns_cliente(UUID);

CREATE POLICY "own empresas" ON public.empresas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()));
CREATE POLICY "own vendas" ON public.vendas_produto FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()));
CREATE POLICY "own despesas" ON public.despesas_fixas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()));
CREATE POLICY "own parametros" ON public.parametros_mensais FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.user_id = auth.uid()));
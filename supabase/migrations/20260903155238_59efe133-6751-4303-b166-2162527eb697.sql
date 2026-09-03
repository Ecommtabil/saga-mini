ALTER TABLE public.parametros_mensais
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS parametros_mensais_cliente_mes_empresa_uidx
  ON public.parametros_mensais (cliente_id, mes, empresa_id)
  WHERE empresa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parametros_mensais_cliente_mes_geral_uidx
  ON public.parametros_mensais (cliente_id, mes)
  WHERE empresa_id IS NULL;
UPDATE public.vendas_produto SET
  tarifa_venda = abs(tarifa_venda),
  tarifa_envio = abs(tarifa_envio),
  receita_envio = abs(receita_envio),
  cupom = abs(cupom),
  comissao_afiliado = abs(comissao_afiliado),
  frete_entrega_direta = abs(frete_entrega_direta),
  cancelamentos = abs(cancelamentos)
WHERE tarifa_venda < 0 OR tarifa_envio < 0 OR receita_envio < 0 OR cupom < 0
   OR comissao_afiliado < 0 OR frete_entrega_direta < 0 OR cancelamentos < 0;
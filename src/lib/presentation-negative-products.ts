import type { DreModel } from "./dre";

/** Keep store/channel/SKU scopes separate so profitable sales cannot hide losses elsewhere. */
export function presentationNegativeProducts(model: DreModel, periodo: string) {
  const empresas = new Map(model.data.empresas.map((e) => [e.id, e.nome]));
  const produtos = new Map<string, {
    sku: string; nome: string; empresa: string; marketplace: string;
    receita: number; margem: number; custoIncompleto: boolean;
  }>();
  for (const v of model.vendasDoPeriodo(periodo)) {
    if (Math.abs(v.cancelamentos) > 0.000001) continue;
    const key = JSON.stringify([v.empresa_id, v.marketplace, v.sku]);
    const item = produtos.get(key) ?? {
      sku: v.sku, nome: v.nome_produto || v.sku,
      empresa: empresas.get(v.empresa_id) ?? "Loja não identificada",
      marketplace: v.marketplace || "Canal não identificado",
      receita: 0, margem: 0, custoIncompleto: false,
    };
    const despesas = v.tarifa_venda + v.tarifa_envio - v.receita_envio
      + v.cupom + v.comissao_afiliado + v.frete_entrega_direta;
    const imposto = v.receita * model.aliquota(v.mes, v.empresa_id) / 100;
    item.receita += v.receita;
    item.margem += v.receita - imposto - (v.custo ?? 0) - despesas;
    item.custoIncompleto ||= v.custo === null;
    produtos.set(key, item);
  }
  return [...produtos.values()]
    .filter((p) => p.margem < 0)
    .sort((a, b) => a.margem - b.margem || a.sku.localeCompare(b.sku)
      || a.empresa.localeCompare(b.empresa) || a.marketplace.localeCompare(b.marketplace))
    .map((p) => ({ ...p, margemPct: p.receita > 0 ? p.margem / p.receita * 100 : null }));
}

export function negativeProductPages(model: DreModel, periodo: string) {
  const itens = presentationNegativeProducts(model, periodo);
  const pages: (typeof itens)[] = [];
  for (let i = 0; i < itens.length; i += 3) pages.push(itens.slice(i, i + 3));
  return pages.length ? pages : [[]];
}
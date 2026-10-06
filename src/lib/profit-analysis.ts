import type { DreModel, Filter } from "./dre";

export function profitAnalysis(model: DreModel, base: string, atual: string, filter: Filter) {
  const b = model.metrics(base, filter, true);
  const a = model.metrics(atual, filter, true);
  // Channel views stop at contribution: fixed expenses have no marketplace attribution.
  const liquida = !filter.marketplace;
  const lucro0 = liquida ? b.lucroLiquido : b.margemContribuicao;
  const lucro1 = liquida ? a.lucroLiquido : a.margemContribuicao;
  const margem0 = b.faturamento > 0 && lucro0 !== null ? lucro0 / b.faturamento * 100 : null;
  const margem1 = a.faturamento > 0 && lucro1 !== null ? lucro1 / a.faturamento * 100 : null;
  const efeitos: [string, number][] = [
    ["Faturamento", a.faturamento - b.faturamento],
    ["Custo dos produtos", b.custo - a.custo],
    ["Imposto Simples", (b.imposto ?? 0) - (a.imposto ?? 0)],
    ["Tarifas, fretes, cupons e comissões (líquidos)", b.despesasVariaveis - a.despesasVariaveis],
    ["Deduções por cancelamentos", b.cancelamentos - a.cancelamentos],
    ...(liquida ? [["Despesas fixas", (b.despesasFixas ?? 0) - (a.despesasFixas ?? 0)] as [string, number]] : []),
  ];
  const semCusto = model.data.vendas.filter(v => (v.mes === base || v.mes === atual)
    && (!filter.empresaId || v.empresa_id === filter.empresaId)
    && (!filter.marketplace || v.marketplace === filter.marketplace)
    && v.custo === null && (v.receita !== 0 || v.unidades !== 0)).length;
  return { b, a, liquida, lucro0, lucro1, margem0, margem1, efeitos, semCusto };
}
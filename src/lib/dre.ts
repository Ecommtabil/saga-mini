import type { Dataset, Venda } from "./types";

export const TOTAL = "TOTAL";

export type Metrics = {
  faturamento: number;
  cancelamentos: number;
  imposto: number | null;
  deducoes: number | null;
  receitaLiquida: number;
  custo: number;
  lucroBruto: number;
  tarifaVenda: number;
  tarifaEnvio: number;
  receitaEnvio: number;
  cupom: number;
  comissaoAfiliado: number;
  freteEntregaDireta: number;
  despesasVariaveis: number;
  margemContribuicao: number;
  despesasFixas: number | null;
  lucroLiquido: number | null;
  pontoEquilibrio: number | null;
  pontoEquilibrioUnidades: number | null;
  margemBrutaPct: number | null;
  margemContribuicaoPct: number | null;
  margemLiquidaPct: number | null;
  unidades: number;
  custosEDespesas: number;
};

const s = (rows: Venda[], f: (v: Venda) => number) =>
  rows.reduce((acc, r) => acc + (Number(f(r)) || 0), 0);

export function metricsFrom(
  rows: Venda[],
  opts: { aliquotaPct: number | null; despesasFixas: number | null },
): Metrics {
  const faturamento = s(rows, (r) => r.receita);
  const cancelamentos = s(rows, (r) => r.cancelamentos);
  const custo = s(rows, (r) => r.custo ?? 0);
  const tarifaVenda = s(rows, (r) => r.tarifa_venda);
  const tarifaEnvio = s(rows, (r) => r.tarifa_envio);
  const receitaEnvio = s(rows, (r) => r.receita_envio);
  const cupom = s(rows, (r) => r.cupom);
  const comissaoAfiliado = s(rows, (r) => r.comissao_afiliado);
  const freteEntregaDireta = s(rows, (r) => r.frete_entrega_direta);
  const imposto =
    opts.aliquotaPct === null ? null : (faturamento * opts.aliquotaPct) / 100;
  const deducoes = imposto === null ? null : cancelamentos + imposto;
  const receitaLiquida = faturamento - cancelamentos - (imposto ?? 0);
  const lucroBruto = receitaLiquida - custo;
  const despesasVariaveis =
    tarifaVenda +
    tarifaEnvio -
    receitaEnvio +
    cupom +
    comissaoAfiliado +
    freteEntregaDireta;
  const margemContribuicao = lucroBruto - despesasVariaveis;
  const despesasFixas = opts.despesasFixas;
  const lucroLiquido =
    despesasFixas === null ? null : margemContribuicao - despesasFixas;
  const unidades = s(rows, (r) => r.unidades);
  // Ponto de Equilíbrio (R$) = Despesas Fixas ÷ (Margem de Contribuição % ÷ 100)
  const margemContribuicaoPct = faturamento > 0 ? (margemContribuicao / faturamento) * 100 : 0;
  const pontoEquilibrio =
    despesasFixas === null || margemContribuicaoPct <= 0
      ? null
      : despesasFixas / (margemContribuicaoPct / 100);
  const mcUnitaria = unidades > 0 ? margemContribuicao / unidades : 0;
  const pontoEquilibrioUnidades =
    despesasFixas === null || mcUnitaria <= 0 ? null : despesasFixas / mcUnitaria;

  return {
    faturamento,
    cancelamentos,
    imposto,
    deducoes,
    receitaLiquida,
    custo,
    lucroBruto,
    tarifaVenda,
    tarifaEnvio,
    receitaEnvio,
    cupom,
    comissaoAfiliado,
    freteEntregaDireta,
    despesasVariaveis,
    margemContribuicao,
    despesasFixas,
    lucroLiquido,
    pontoEquilibrio,
    pontoEquilibrioUnidades,
    margemBrutaPct: faturamento > 0 ? (lucroBruto / faturamento) * 100 : null,
    margemContribuicaoPct: margemContribuicaoPct,
    margemLiquidaPct:
      faturamento > 0 && lucroLiquido !== null
        ? (lucroLiquido / faturamento) * 100
        : null,
    unidades,
    custosEDespesas: custo + despesasVariaveis + (despesasFixas ?? 0),
  };
}

export type Filter = { empresaId?: string | null; marketplace?: string | null };

export function filterVendas(vendas: Venda[], f: Filter) {
  return vendas.filter(
    (v) =>
      (!f.empresaId || v.empresa_id === f.empresaId) &&
      (!f.marketplace || v.marketplace === f.marketplace),
  );
}

export class DreModel {
  meses: string[];
  constructor(public data: Dataset) {
    this.meses = Array.from(new Set(data.vendas.map((v) => v.mes))).sort();
  }

  get marketplaces() {
    return Array.from(
      new Set(this.data.vendas.map((v) => v.marketplace || "N/D")),
    ).sort();
  }

  aliquota(mes: string) {
    const p = this.data.parametros.find((x) => x.mes === mes);
    return p ? Number(p.aliquota_simples_pct) : Number(this.data.cliente.aliquota_simples_padrao);
  }

  fixasDoMes(mes: string, empresaId?: string | null) {
    return this.data.fixas.filter(
      (f) => f.mes === mes && (!empresaId || f.empresa_id === empresaId),
    );
  }

  vendasDoPeriodo(periodo: string, filter: Filter = {}) {
    const rows = filterVendas(this.data.vendas, filter);
    return periodo === TOTAL ? rows : rows.filter((v) => v.mes === periodo);
  }

  /**
   * Métricas de um período. `atribuivel: false` (empresa/marketplace) omite
   * Imposto Simples e Despesas Fixas — não são rastreados por canal/loja.
   */
  metrics(
    periodo: string,
    filter: Filter = {},
    atribuivel = true,
  ): Metrics {
    const meses = periodo === TOTAL ? this.meses : [periodo];
    if (!atribuivel) {
      const rows = this.vendasDoPeriodo(periodo, filter);
      return metricsFrom(rows, { aliquotaPct: null, despesasFixas: null });
    }
    // Soma mês a mês para respeitar alíquotas mensais distintas.
    const parts = meses.map((mes) => {
      const rows = this.vendasDoPeriodo(mes, filter);
      const fixas = this.fixasDoMes(mes, filter.empresaId).reduce(
        (a, f) => a + Number(f.valor),
        0,
      );
      return metricsFrom(rows, {
        aliquotaPct: this.aliquota(mes),
        despesasFixas: fixas,
      });
    });
    if (parts.length === 1) return parts[0]!;
    const rows = this.vendasDoPeriodo(periodo, filter);
    const impostoTotal = parts.reduce((a, p) => a + (p.imposto ?? 0), 0);
    const fixasTotal = parts.reduce((a, p) => a + (p.despesasFixas ?? 0), 0);
    const base = metricsFrom(rows, { aliquotaPct: 0, despesasFixas: 0 });
    return recompose(base, impostoTotal, fixasTotal);
  }

  periodos(): string[] {
    return [...this.meses, TOTAL];
  }
}

function recompose(
  base: Metrics,
  imposto: number,
  despesasFixas: number,
): Metrics {
  const receitaLiquida = base.faturamento - base.cancelamentos - imposto;
  const lucroBruto = receitaLiquida - base.custo;
  const margemContribuicao = lucroBruto - base.despesasVariaveis;
  const lucroLiquido = margemContribuicao - despesasFixas;
  // Ponto de Equilíbrio (R$) = Despesas Fixas ÷ (Margem de Contribuição % ÷ 100)
  const margemContribuicaoPct = base.faturamento > 0 ? (margemContribuicao / base.faturamento) * 100 : 0;
  const mcUnitaria = base.unidades > 0 ? margemContribuicao / base.unidades : 0;
  return {
    ...base,
    imposto,
    deducoes: base.cancelamentos + imposto,
    receitaLiquida,
    lucroBruto,
    margemContribuicao,
    despesasFixas,
    lucroLiquido,
    pontoEquilibrio: margemContribuicaoPct > 0 ? despesasFixas / (margemContribuicaoPct / 100) : null,
    pontoEquilibrioUnidades:
      mcUnitaria > 0 ? despesasFixas / mcUnitaria : null,
    margemBrutaPct:
      base.faturamento > 0 ? (lucroBruto / base.faturamento) * 100 : null,
    margemContribuicaoPct: margemContribuicaoPct,
    margemLiquidaPct:
      base.faturamento > 0 ? (lucroLiquido / base.faturamento) * 100 : null,
    custosEDespesas: base.custo + base.despesasVariaveis + despesasFixas,
  };
}

/* ------------------------- Estrutura da cascata ------------------------- */

export type DreLine = {
  key: string;
  label: string;
  kind: "synth" | "analytic";
  parent?: string;
  /** valor por período */
  values: Record<string, number | null>;
  invertSign?: boolean;
  reference?: boolean;
};

export type BuildOpts = {
  /** detalhar as linhas analíticas por empresa ou por marketplace */
  detalhe: "empresa" | "marketplace" | "nenhum";
  filter?: Filter;
  /** incluir despesas fixas / lucro líquido / ponto de equilíbrio */
  completo: boolean;
};

export function buildDre(model: DreModel, opts: BuildOpts): DreLine[] {
  const periodos = model.periodos();
  const lines: DreLine[] = [];
  const filter = opts.filter ?? {};

  const grupos: { id: string; nome: string; filter: Filter }[] =
    opts.detalhe === "empresa"
      ? model.data.empresas.map((e) => ({
          id: e.id,
          nome: e.nome,
          filter: { ...filter, empresaId: e.id },
        }))
      : opts.detalhe === "marketplace"
        ? model.marketplaces.map((m) => ({
            id: m,
            nome: m,
            filter: { ...filter, marketplace: m },
          }))
        : [];

  const val = (
    pick: (m: Metrics) => number | null,
    f: Filter,
    atribuivel: boolean,
  ) => {
    const values: Record<string, number | null> = {};
    for (const p of periodos) values[p] = pick(model.metrics(p, f, atribuivel));
    return values;
  };

  const add = (
    key: string,
    label: string,
    kind: "synth" | "analytic",
    pick: (m: Metrics) => number | null,
    extra: Partial<DreLine> = {},
  ) => {
    lines.push({
      key,
      label,
      kind,
      values: val(pick, filter, true),
      ...extra,
    });
  };

  const addChildren = (
    parent: string,
    pick: (m: Metrics) => number | null,
  ) => {
    if (grupos.length < 2) return;
    for (const g of grupos) {
      lines.push({
        key: `${parent}:${g.id}`,
        label: `${labelFor(parent)} — ${g.nome}`,
        kind: "analytic",
        parent,
        values: val(pick, g.filter, false),
      });
    }
  };

  add("FATURAMENTO", "FATURAMENTO", "synth", (m) => m.faturamento);
  addChildren("FATURAMENTO", (m) => m.faturamento);

  add("DEDUCOES", "(-) DEDUÇÕES", "synth", (m) => m.deducoes);
  lines.push({
    key: "DEDUCOES:canc",
    label: "Cancelamentos e Reembolsos",
    kind: "analytic",
    parent: "DEDUCOES",
    values: val((m) => m.cancelamentos, filter, true),
  });
  if (grupos.length >= 2)
    for (const g of grupos)
      lines.push({
        key: `DEDUCOES:canc:${g.id}`,
        label: `Cancelamentos — ${g.nome}`,
        kind: "analytic",
        parent: "DEDUCOES",
        values: val((m) => m.cancelamentos, g.filter, false),
      });
  lines.push({
    key: "DEDUCOES:imposto",
    label: "Imposto Simples Nacional (não atribuível por loja/canal)",
    kind: "analytic",
    parent: "DEDUCOES",
    values: val((m) => m.imposto, filter, true),
  });

  add("RECEITA_LIQUIDA", "(=) RECEITA LÍQUIDA", "synth", (m) => m.receitaLiquida);
  addChildren("RECEITA_LIQUIDA", (m) => m.receitaLiquida);

  add("CUSTOS", "(-) CUSTOS", "synth", (m) => m.custo);
  addChildren("CUSTOS", (m) => m.custo);

  add("LUCRO_BRUTO", "(=) LUCRO BRUTO", "synth", (m) => m.lucroBruto);
  addChildren("LUCRO_BRUTO", (m) => m.lucroBruto);

  add("DESP_VAR", "(-) DESPESAS VARIÁVEIS", "synth", (m) => m.despesasVariaveis);
  const componentes: [string, string, (m: Metrics) => number][] = [
    ["tarifa_venda", "Tarifa de Venda", (m) => m.tarifaVenda],
    ["tarifa_envio", "Tarifa de Envio", (m) => m.tarifaEnvio],
    ["receita_envio", "Receita por Envio (contra-conta)", (m) => -m.receitaEnvio],
    ["cupom", "Cupom", (m) => m.cupom],
    ["comissao", "Comissão Afiliado", (m) => m.comissaoAfiliado],
    ["frete", "Frete Entrega Direta", (m) => m.freteEntregaDireta],
  ];
  for (const [id, label, pick] of componentes) {
    lines.push({
      key: `DESP_VAR:${id}`,
      label,
      kind: "analytic",
      parent: "DESP_VAR",
      values: val(pick, filter, true),
    });
    if (grupos.length >= 2)
      for (const g of grupos)
        lines.push({
          key: `DESP_VAR:${id}:${g.id}`,
          label: `${label} — ${g.nome}`,
          kind: "analytic",
          parent: "DESP_VAR",
          values: val(pick, g.filter, false),
        });
  }

  add(
    "MARGEM_CONTRIBUICAO",
    "(=) MARGEM DE CONTRIBUIÇÃO",
    "synth",
    (m) => m.margemContribuicao,
  );
  addChildren("MARGEM_CONTRIBUICAO", (m) => m.margemContribuicao);

  if (opts.completo) {
    add("DESP_FIXAS", "(-) DESPESAS FIXAS", "synth", (m) => m.despesasFixas);
    const nomes = Array.from(new Set(model.data.fixas.map((f) => f.nome)));
    for (const nome of nomes) {
      const values: Record<string, number | null> = {};
      for (const p of periodos) {
        const meses = p === TOTAL ? model.meses : [p];
        values[p] = model.data.fixas
          .filter((f) => f.nome === nome && meses.includes(f.mes))
          .reduce((a, f) => a + Number(f.valor), 0);
      }
      lines.push({
        key: `DESP_FIXAS:${nome}`,
        label: nome,
        kind: "analytic",
        parent: "DESP_FIXAS",
        values,
      });
    }

    add(
      "LUCRO_LIQUIDO",
      "(=) LUCRO LÍQUIDO OU PREJUÍZO",
      "synth",
      (m) => m.lucroLiquido,
    );
    add(
      "PONTO_EQUILIBRIO",
      "(=) PONTO DE EQUILÍBRIO (FATURAMENTO)",
      "synth",
      (m) => m.pontoEquilibrio,
      { reference: true },
    );
  }

  return lines;
}

function labelFor(parent: string) {
  switch (parent) {
    case "FATURAMENTO":
      return "Faturamento";
    case "RECEITA_LIQUIDA":
      return "Receita Líquida";
    case "CUSTOS":
      return "Custo";
    case "LUCRO_BRUTO":
      return "Lucro Bruto";
    case "DESP_VAR":
      return "Despesas Variáveis";
    case "MARGEM_CONTRIBUICAO":
      return "Margem de Contribuição";
    default:
      return parent;
  }
}

/** métricas disponíveis para o gráfico tesoura / tabelas de apoio */
export const METRICAS: { key: keyof Metrics; label: string; isPct?: boolean }[] = [
  { key: "faturamento", label: "Faturamento" },
  { key: "cancelamentos", label: "Cancelamentos" },
  { key: "imposto", label: "Imposto Simples Nacional" },
  { key: "receitaLiquida", label: "Receita Líquida" },
  { key: "custo", label: "Custos" },
  { key: "lucroBruto", label: "Lucro Bruto" },
  { key: "despesasVariaveis", label: "Despesas Variáveis" },
  { key: "margemContribuicao", label: "Margem de Contribuição" },
  { key: "despesasFixas", label: "Despesas Fixas" },
  { key: "lucroLiquido", label: "Lucro Líquido" },
  { key: "pontoEquilibrio", label: "Ponto de Equilíbrio" },
  { key: "margemBrutaPct", label: "Margem Bruta %", isPct: true },
  { key: "margemContribuicaoPct", label: "Margem de Contribuição %", isPct: true },
  { key: "margemLiquidaPct", label: "Margem Líquida %", isPct: true },
];

export const ah = (atual: number | null, anterior: number | null) => {
  if (atual === null || anterior === null || !anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
};

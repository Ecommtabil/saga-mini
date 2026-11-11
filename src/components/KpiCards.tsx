import { Line, LineChart, ResponsiveContainer } from "recharts";
import { TOTAL, type DreModel, type Metrics } from "@/lib/dre";
import { brl, mesLabel, num, pct } from "@/lib/format";
import type { Filter } from "@/lib/dre";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type KpiDef = {
  label: string;
  pick: (m: Metrics) => number | null;
  format?: (v: number | null) => string;
  sub?: (m: Metrics) => { texto: string; positivo: boolean | null } | null;
  /** Força o modo de atribuição das métricas deste KPI (ex.: ponto de equilíbrio precisa das fixas). */
  atribuivel?: boolean;
  /** Explicação da conta exibida no tooltip. */
  ajuda?: string;
};

export const KPI_PONTO_EQUILIBRIO: KpiDef = {
  label: "Ponto de Equilíbrio", ajuda: "Faturamento mínimo para cobrir as despesas fixas: Despesas Fixas ÷ (Margem de Contribuição % ÷ 100).",
  pick: (m) => m.pontoEquilibrio,
  format: (v) => brl(v),
  atribuivel: true,
  sub: (m) => {
    if (m.pontoEquilibrio === null)
      return { texto: "Sem margem de contribuição positiva", positivo: null };
    const cobertura = m.pontoEquilibrio > 0 ? (m.faturamento / m.pontoEquilibrio) * 100 : null;
    return {
      texto: `Faturamento cobre ${pct(cobertura)} do necessário`,
      positivo: (cobertura ?? 0) >= 100,
    };
  },
};

export const KPI_PONTO_EQUILIBRIO_UNIDADES: KpiDef = {
  label: "Ponto de Equilíbrio (vendas)", ajuda: "Quantidade de vendas necessária para cobrir as despesas fixas: Despesas Fixas ÷ margem de contribuição média por venda.",
  pick: (m) => m.pontoEquilibrioUnidades,
  format: (v) => (v === null || v === undefined ? "N/D" : `${num(v, 0)} vendas`),
  atribuivel: true,
  sub: (m) => {
    if (m.pontoEquilibrioUnidades === null)
      return { texto: "Sem margem de contribuição positiva", positivo: null };
    const cobertura =
      m.pontoEquilibrioUnidades > 0 ? (m.unidades / m.pontoEquilibrioUnidades) * 100 : null;
    return {
      texto: `Vendas atuais cobrem ${pct(cobertura)} do necessário · ${brl(m.pontoEquilibrio)}`,
      positivo: (cobertura ?? 0) >= 100,
    };
  },
};

export const KPI_UNIDADES_VENDIDAS: KpiDef = {
  label: "Unidades Vendidas", ajuda: "Total de unidades vendidas no período, sem contar vendas canceladas. Ticket médio = Faturamento ÷ Unidades.",
  pick: (m) => m.unidades,
  format: (v) => num(v, 0),
  sub: (m) => ({
    texto: `Ticket médio ${m.unidades > 0 ? brl(m.faturamento / m.unidades) : "N/D"}`,
    positivo: null,
  }),
};

export const KPI_PADRAO: KpiDef[] = [
  KPI_UNIDADES_VENDIDAS,
  { label: "Faturamento", ajuda: "Receita bruta das vendas por produto no período (vendas canceladas não entram).", pick: (m) => m.faturamento },
  { label: "Receita Líquida", ajuda: "Faturamento menos deduções (impostos sobre a venda, como o Simples Nacional, e cancelamentos).", pick: (m) => m.receitaLiquida },
  {
    label: "Lucro Bruto", ajuda: "Receita Líquida menos o custo dos produtos vendidos. Margem bruta = Lucro Bruto ÷ Faturamento.",
    pick: (m) => m.lucroBruto,
    sub: (m) => ({
      texto: `Margem bruta ${pct(m.margemBrutaPct)}`,
      positivo: (m.margemBrutaPct ?? 0) >= 0,
    }),
  },
  {
    label: "Lucro Líquido", ajuda: "Resultado final: Margem de Contribuição menos despesas fixas. Margem líquida = Lucro Líquido ÷ Faturamento.",
    pick: (m) => m.lucroLiquido,
    sub: (m) => ({
      texto: `Margem líquida ${pct(m.margemLiquidaPct)}`,
      positivo: (m.lucroLiquido ?? 0) >= 0,
    }),
  },
  {
    label: "Custos + Despesas", ajuda: "Soma de custo dos produtos, impostos, despesas variáveis e despesas fixas do período.",
    pick: (m) => m.custosEDespesas,
    sub: (m) => ({
      texto: `${pct(m.faturamento ? (m.custosEDespesas / m.faturamento) * 100 : null)} do faturamento`,
      positivo: null,
    }),
  },
  KPI_PONTO_EQUILIBRIO,
  KPI_PONTO_EQUILIBRIO_UNIDADES,
];

export function KpiCards({
  model,
  periodo,
  filter,
  atribuivel = true,
  kpis = KPI_PADRAO,
}: {
  model: DreModel;
  periodo: string;
  filter?: Filter;
  atribuivel?: boolean;
  kpis?: KpiDef[];
}) {
  const metricasDe = (attr: boolean) => ({
    atual: model.metrics(periodo, filter, attr),
    serie: model.meses.map((mes) => ({ mes, ...model.metrics(mes, filter, attr) })),
  });
  const base = metricasDe(atribuivel);
  const alternativo = metricasDe(!atribuivel);

  return (
    <div
      className={`kpi-grid${kpis.length === 4 ? " cols-4" : kpis.length === 6 ? " cols-6" : kpis.length === 7 ? " cols-7" : kpis.length === 8 ? " cols-8" : ""}`}
    >
      {kpis.map((k) => {
        const fonte =
          k.atribuivel === undefined || k.atribuivel === atribuivel ? base : alternativo;
        const m = fonte.atual;
        const sub = k.sub?.(m) ?? null;
        const valor = k.pick(m);
        const valorFormatado = k.format ? k.format(valor) : brl(valor);
        const dados = fonte.serie.map((s) => ({
          mes: mesLabel(s.mes),
          v: k.pick(s) ?? 0,
        }));
        return (
          <div className="kpi-card" key={k.label}>
            <div className="label">
              {k.label}
              {k.ajuda && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="kpi-help" aria-label={`Como é calculado: ${k.label}`}>ⓘ</button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{k.ajuda}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="value">{valorFormatado}</div>
            {sub && (
              <div
                className={`sub ${sub.positivo === null ? "na" : sub.positivo ? "pos" : "neg"}`}
              >
                {sub.texto}
              </div>
            )}
            <div className="sparkline">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="sub na">
              {periodo === TOTAL ? "Período total" : mesLabel(periodo)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

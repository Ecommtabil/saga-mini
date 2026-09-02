import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { METRICAS, TOTAL, ah, type DreModel, type Metrics } from "@/lib/dre";
import { brl, mesLabel, pct } from "@/lib/format";

const CORES = [
  "#2e5eaa",
  "#29abe2",
  "#f2c14e",
  "#1e7e34",
  "#c00000",
  "#7b5ea7",
  "#b8720a",
  "#4f8fdb",
];

export function AnaliseGerencial({ model }: { model: DreModel }) {
  const [a, setA] = useState<keyof Metrics>("faturamento");
  const [b, setB] = useState<keyof Metrics>("lucroLiquido");

  const serie = model.meses.map((mes) => model.metrics(mes));
  // Primeiro mês é a base (0%); os seguintes mostram a variação % vs. mês anterior.
  const tesoura = model.meses.map((mes, i) => ({
    mes: mesLabel(mes),
    A: i === 0 ? 0 : (ah(serie[i]![a] as number | null, serie[i - 1]![a] as number | null) ?? 0),
    B: i === 0 ? 0 : (ah(serie[i]![b] as number | null, serie[i - 1]![b] as number | null) ?? 0),
  }));

  const ultimo = tesoura[tesoura.length - 1];
  const diferenca = ultimo ? (ultimo.A ?? 0) - (ultimo.B ?? 0) : 0;




  const marketplaces = model.marketplaces;
  const participacao = model.meses.map((mes) => {
    const total = model.metrics(mes).faturamento;
    const row: Record<string, string | number> = { mes: mesLabel(mes) };
    for (const mk of marketplaces) {
      const v = model.metrics(mes, { marketplace: mk }, false).faturamento;
      row[mk] = total > 0 ? (v / total) * 100 : 0;
    }
    return row;
  });

  const labelDe = (k: keyof Metrics) =>
    METRICAS.find((m) => m.key === k)?.label ?? String(k);

  const periodos = model.periodos();

  return (
    <>
      <section className="panel bleed">
        <h2>Gráfico Tesoura — variação % mês a mês (AH)</h2>
        <div className="filters">
          <div className="field">
            <label>Métrica A</label>
            <select value={a} onChange={(e) => setA(e.target.value as keyof Metrics)}>
              {METRICAS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Métrica B</label>
            <select value={b} onChange={(e) => setB(e.target.value as keyof Metrics)}>
              {METRICAS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {tesoura.length === 0 ? (
          <p className="muted">
            A variação mês a mês (AH) precisa de pelo menos duas competências com dados.
            Importe outro mês para traçar as linhas do gráfico tesoura.
          </p>
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tesoura}>
                <CartesianGrid stroke="#eaf1fb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v as number)}%`}
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip formatter={(v) => pct(v as number)} />
                <Legend
                  payload={[
                    { value: labelDe(a), type: "line", id: "A", color: "#2e5eaa" },
                    { value: labelDe(b), type: "line", id: "B", color: "#b8720a" },
                  ]}
                />

                <Area
                  dataKey="A"
                  name={labelDe(a)}
                  stroke="none"
                  fill="#2e5eaa"
                  fillOpacity={0.14}
                  legendType="none"
                  tooltipType="none"
                  connectNulls
                />
                <Area
                  dataKey="B"
                  name={labelDe(b)}
                  stroke="none"
                  fill="#b8720a"
                  fillOpacity={0.14}
                  legendType="none"
                  tooltipType="none"
                  connectNulls
                />
                <Line
                  dataKey="A"
                  name={labelDe(a)}
                  stroke="#2e5eaa"
                  strokeWidth={2.5}
                  dot
                  connectNulls
                />
                <Line
                  dataKey="B"
                  name={labelDe(b)}
                  stroke="#b8720a"
                  strokeWidth={2.5}
                  dot
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

      </section>

      <section className="panel bleed">
        <h2>Participação por Marketplace no Faturamento (100%)</h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={participacao} stackOffset="expand">
              <CartesianGrid stroke="#eaf1fb" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${Math.round((v as number) * 100)}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => pct(v as number)} />
              <Legend />
              {marketplaces.map((mk, i) => (
                <Bar
                  key={mk}
                  dataKey={mk}
                  stackId="a"
                  fill={CORES[i % CORES.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel bleed">
        <h2>Margens por mês</h2>
        <div className="wide-table-wrap">
          <table className="wide-dre">
            <thead>
              <tr>
                <th>Indicador</th>
                {periodos.map((p) => (
                  <th key={p} className="sub-head">
                    {p === TOTAL ? "Período Total" : mesLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Margem Bruta %", "margemBrutaPct"],
                  ["Margem de Contribuição %", "margemContribuicaoPct"],
                  ["Margem Líquida %", "margemLiquidaPct"],
                ] as [string, keyof Metrics][]
              ).map(([label, key]) => (
                <tr key={key} className="analytic-row">
                  <td>{label}</td>
                  {periodos.map((p) => {
                    const v = model.metrics(p)[key] as number | null;
                    return (
                      <td key={p}>
                        {v === null ? <span className="na">N/D</span> : pct(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel bleed">
        <h2>Análise Vertical e Horizontal completas</h2>
        <div className="wide-table-wrap">
          <table className="wide-dre">
            <thead>
              <tr>
                <th>Conta</th>
                {model.meses.map((m) => (
                  <th className="group-head" colSpan={2} key={m}>
                    {mesLabel(m)}
                  </th>
                ))}
              </tr>
              <tr>
                {model.meses.map((m) => [
                  <th className="sub-head" key={`${m}av`}>
                    AV%
                  </th>,
                  <th className="sub-head" key={`${m}ah`}>
                    AH%
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {METRICAS.filter((m) => !m.isPct).map((met) => (
                <tr key={met.key} className="analytic-row">
                  <td>{met.label}</td>
                  {model.meses.map((mes, i) => {
                    const m = model.metrics(mes);
                    const v = m[met.key] as number | null;
                    const av =
                      v === null || !m.faturamento ? null : (v / m.faturamento) * 100;
                    const ant =
                      i === 0
                        ? null
                        : (model.metrics(model.meses[i - 1]!)[met.key] as number | null);
                    const varia = i === 0 ? null : ah(v, ant);
                    return [
                      <td key={`${mes}av`}>
                        {av === null ? <span className="na">N/D</span> : pct(av)}
                      </td>,
                      <td key={`${mes}ah`}>
                        {varia === null ? (
                          <span className="na">N/D</span>
                        ) : (
                          <span className={varia >= 0 ? "ah-pos" : "ah-neg"}>
                            {pct(varia)}
                          </span>
                        )}
                      </td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Valores em reais das mesmas contas estão na aba DRE Gerencial. Exemplo
          de leitura: Faturamento do período total = {brl(model.metrics(TOTAL).faturamento)}.
        </p>
      </section>
    </>
  );
}

import { useMemo, useState } from "react";
import { TOTAL, metricsFrom, type DreModel, type Metrics } from "@/lib/dre";
import { brl, pct } from "@/lib/format";

type Estado = {
  varFat: number;
  custoPct: number;
  despVarPct: number;
  fixas: number;
  aliquota: number;
};

export function Simuladores({ model }: { model: DreModel }) {
  const base = useMemo(() => model.metrics(TOTAL), [model]);
  const aliquotaBase = useMemo(() => {
    const fat = base.faturamento;
    return fat > 0 ? ((base.imposto ?? 0) / fat) * 100 : model.data.cliente.aliquota_simples_padrao;
  }, [base, model]);

  const inicial: Estado = {
    varFat: 0,
    custoPct: base.faturamento > 0 ? (base.custo / base.faturamento) * 100 : 0,
    despVarPct:
      base.faturamento > 0 ? (base.despesasVariaveis / base.faturamento) * 100 : 0,
    fixas: base.despesasFixas ?? 0,
    aliquota: aliquotaBase,
  };
  const [st, setSt] = useState<Estado>(inicial);
  const [modoFixas, setModoFixas] = useState<"rs" | "pct">("rs");

  const sim = useMemo<Metrics>(() => {
    const faturamento = base.faturamento * (1 + st.varFat / 100);
    const cancelRatio = base.faturamento > 0 ? base.cancelamentos / base.faturamento : 0;
    const rows = [
      {
        id: "sim",
        cliente_id: "",
        empresa_id: "",
        marketplace: "",
        mes: "",
        sku: "",
        nome_produto: "",
        fornecedor: null,
        unidades: 0,
        receita: faturamento,
        custo: (faturamento * st.custoPct) / 100,
        tarifa_venda: (faturamento * st.despVarPct) / 100,
        tarifa_envio: 0,
        receita_envio: 0,
        cupom: 0,
        comissao_afiliado: 0,
        frete_entrega_direta: 0,
        cancelamentos: faturamento * cancelRatio,
      },
    ];
    return metricsFrom(rows, {
      aliquotaPct: st.aliquota,
      despesasFixas: st.fixas,
    });
  }, [st, base]);

  const linhas: [string, keyof Metrics, boolean?][] = [
    ["Faturamento", "faturamento"],
    ["Cancelamentos", "cancelamentos"],
    ["Imposto Simples Nacional", "imposto"],
    ["Receita Líquida", "receitaLiquida"],
    ["Custos", "custo"],
    ["Lucro Bruto", "lucroBruto"],
    ["Despesas Variáveis", "despesasVariaveis"],
    ["Margem de Contribuição", "margemContribuicao"],
    ["Despesas Fixas", "despesasFixas"],
    ["Lucro Líquido", "lucroLiquido"],
    ["Ponto de Equilíbrio", "pontoEquilibrio"],
    ["Margem Líquida %", "margemLiquidaPct", true],
  ];

  const impacto = (sim.lucroLiquido ?? 0) - (base.lucroLiquido ?? 0);

  const slider = (
    label: string,
    valor: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
    fmt: (v: number) => string,
    baseTexto: string,
  ) => (
    <div className="sim-row" key={label}>
      <div className="sim-row-head">
        <span className="sim-label">{label}</span>
        <span>
          <span className="sim-val">{fmt(valor)}</span>
          <span className="sim-base">base {baseTexto}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );

  return (
    <div className="sim-grid">
      <section className="panel">
        <h2>Premissas do cenário</h2>
        <p className="table-note" style={{ marginTop: -8, marginBottom: 18 }}>
          Cenário-base: Período Total consolidado.
        </p>
        {slider(
          "Variação do Faturamento",
          st.varFat,
          -50,
          100,
          1,
          (v) => setSt((s) => ({ ...s, varFat: v })),
          (v) => pct(v),
          "0,0%",
        )}
        {slider(
          "Custo (% do faturamento)",
          st.custoPct,
          0,
          100,
          0.5,
          (v) => setSt((s) => ({ ...s, custoPct: v })),
          (v) => pct(v),
          pct(inicial.custoPct),
        )}
        {slider(
          "Despesas Variáveis (% do faturamento)",
          st.despVarPct,
          0,
          60,
          0.5,
          (v) => setSt((s) => ({ ...s, despVarPct: v })),
          (v) => pct(v),
          pct(inicial.despVarPct),
        )}
        <div className="sim-row">
          <div className="sim-row-head">
            <span className="sim-label">
              Despesas Fixas (período)
              <span className="sim-mode-toggle">
                <button
                  className={`sim-mode-btn ${modoFixas === "rs" ? "active" : ""}`}
                  onClick={() => setModoFixas("rs")}
                >
                  R$
                </button>
                <button
                  className={`sim-mode-btn ${modoFixas === "pct" ? "active" : ""}`}
                  onClick={() => setModoFixas("pct")}
                >
                  %
                </button>
              </span>
            </span>
            <span>
              <span className="sim-val">
                {modoFixas === "rs"
                  ? brl(st.fixas)
                  : pct(sim.faturamento > 0 ? (st.fixas / sim.faturamento) * 100 : null)}
              </span>
              <span className="sim-base">base {brl(inicial.fixas)}</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(inicial.fixas * 3, 1000)}
            step={Math.max(inicial.fixas / 100, 10)}
            value={st.fixas}
            onChange={(e) => setSt((s) => ({ ...s, fixas: Number(e.target.value) }))}
          />
        </div>
        {slider(
          "Alíquota do Simples Nacional",
          st.aliquota,
          0,
          33,
          0.05,
          (v) => setSt((s) => ({ ...s, aliquota: v })),
          (v) => pct(v, 2),
          pct(aliquotaBase, 2),
        )}
        <div className={`sim-impact-box ${impacto < 0 ? "negative" : ""}`}>
          <div className="sim-impact-label">Impacto no Lucro Líquido</div>
          <div className="sim-impact-value">
            {impacto >= 0 ? "+" : ""}
            {brl(impacto)}
          </div>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => setSt(inicial)}>
          Restaurar premissas base
        </button>
      </section>

      <section className="panel">
        <h2>DRE Base × Simulado</h2>
        <div className="wide-table-wrap">
          <table className="wide-dre">
            <thead>
              <tr>
                <th>Conta</th>
                <th className="sub-head">Base</th>
                <th className="sub-head">Simulado</th>
                <th className="sub-head">Δ (R$)</th>
                <th className="sub-head">Δ (%)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(([label, key, isPct]) => {
                const b = base[key] as number | null;
                const s = sim[key] as number | null;
                const delta = b === null || s === null ? null : s - b;
                const deltaPct =
                  b === null || s === null || !b ? null : ((s - b) / Math.abs(b)) * 100;
                return (
                  <tr key={key} className="analytic-row">
                    <td>{label}</td>
                    <td>{isPct ? pct(b) : b === null ? <span className="na">N/D</span> : brl(b)}</td>
                    <td>{isPct ? pct(s) : s === null ? <span className="na">N/D</span> : brl(s)}</td>
                    <td>
                      {delta === null ? (
                        <span className="na">N/D</span>
                      ) : isPct ? (
                        <span className={delta >= 0 ? "ah-pos" : "ah-neg"}>{pct(delta)}</span>
                      ) : (
                        <span className={delta >= 0 ? "ah-pos" : "ah-neg"}>{brl(delta)}</span>
                      )}
                    </td>
                    <td>
                      {deltaPct === null ? (
                        <span className="na">N/D</span>
                      ) : (
                        <span className={deltaPct >= 0 ? "ah-pos" : "ah-neg"}>{pct(deltaPct)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

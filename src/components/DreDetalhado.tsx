import { useState } from "react";
import { buildDre, type DreModel } from "@/lib/dre";
import { DreWideTable } from "./DreWideTable";
import { KpiCards, KPI_PONTO_EQUILIBRIO, type KpiDef } from "./KpiCards";
import { brl, pct } from "@/lib/format";

const KPIS_EMPRESA: KpiDef[] = [
  { label: "Faturamento", pick: (m) => m.faturamento },
  { label: "Receita Líquida (sem imposto)", pick: (m) => m.receitaLiquida },
  {
    label: "Lucro Bruto",
    pick: (m) => m.lucroBruto,
    sub: (m) => ({
      texto: `Margem bruta ${pct(m.margemBrutaPct)}`,
      positivo: (m.margemBrutaPct ?? 0) >= 0,
    }),
  },
  {
    label: "Margem de Contribuição",
    pick: (m) => m.margemContribuicao,
    sub: (m) => ({
      texto: `${pct(m.margemContribuicaoPct)} do faturamento`,
      positivo: (m.margemContribuicao ?? 0) >= 0,
    }),
  },
  {
    label: "Lucro Líquido da Loja",
    pick: (m) => m.lucroLiquido,
    atribuivel: true,
    sub: (m) => ({
      texto: `Margem líquida ${pct(m.margemLiquidaPct)}`,
      positivo: (m.lucroLiquido ?? 0) >= 0,
    }),
  },
  KPI_PONTO_EQUILIBRIO,
];


export function DreDetalhado({
  model,
  periodo,
  empresaId,
  onEmpresa,
}: {
  model: DreModel;
  periodo: string;
  empresaId: string | null;
  onEmpresa: (id: string | null) => void;
}) {
  const [interno, setInterno] = useState<string | null>(empresaId);
  const sel = interno;

  const escolher = (id: string | null) => {
    setInterno(id);
    onEmpresa(id);
  };

  const lines = sel
    ? buildDre(model, {
        detalhe: "marketplace",
        filter: { empresaId: sel },
        completo: false,
      })
    : buildDre(model, { detalhe: "empresa", completo: true });

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "flex-start" }}>
        <button className={!sel ? "active" : ""} onClick={() => escolher(null)}>
          🏢 Consolidado (todas as empresas)
        </button>
        {model.data.empresas.map((e) => (
          <button
            key={e.id}
            className={sel === e.id ? "active" : ""}
            onClick={() => escolher(e.id)}
          >
            {e.nome}
          </button>
        ))}
      </div>

      {sel ? (
        <KpiCards
          model={model}
          periodo={periodo}
          filter={{ empresaId: sel }}
          atribuivel={false}
          kpis={KPIS_EMPRESA}
        />
      ) : (
        <KpiCards model={model} periodo={periodo} />
      )}

      {!sel && model.data.empresas.length >= 2 && (
        <section className="panel">
          <h2>Lucro Líquido por Loja</h2>
          <div
            className={`kpi-grid${model.data.empresas.length === 4 ? " cols-4" : model.data.empresas.length >= 6 ? " cols-6" : ""}`}
          >
            {model.data.empresas.map((e) => {
              const m = model.metrics(periodo, { empresaId: e.id }, true);
              return (
                <div className="kpi-card" key={e.id}>
                  <div className="label">{e.nome}</div>
                  <div className="value">{brl(m.lucroLiquido)}</div>
                  <div
                    className={`sub ${(m.lucroLiquido ?? 0) >= 0 ? "pos" : "neg"}`}
                  >
                    Margem líquida {pct(m.margemLiquidaPct)}
                  </div>
                  <div className="sub na">
                    Faturamento {brl(m.faturamento)} · Fixas {brl(m.despesasFixas)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="table-note">
            Lucro líquido por loja considera o Imposto Simples Nacional rateado
            pela receita da própria loja e apenas as despesas fixas cadastradas
            para ela. Despesas fixas lançadas sem empresa (rateio do grupo) não
            entram nestes cartões.
          </p>
        </section>
      )}


      <section className="panel bleed">
        <h2>
          {sel
            ? `DRE por Marketplace — ${model.data.empresas.find((e) => e.id === sel)?.nome}`
            : "DRE Consolidada por Empresa"}
        </h2>
        <DreWideTable
          model={model}
          lines={lines}
          nota={
            sel
              ? "Visão de loja única: a cascata vai até a Margem de Contribuição. Despesas fixas e Imposto Simples Nacional não são rastreados por loja/canal e por isso não aparecem aqui. Cancelamentos SÃO rastreados por linha de produto (empresa × marketplace), então a Margem de Contribuição por canal reconcilia exatamente com a linha síntese."
              : "Cada linha analítica é uma empresa do grupo. O Imposto Simples Nacional aparece em linha única por não ser atribuível por loja."
          }
        />
      </section>
    </>
  );
}

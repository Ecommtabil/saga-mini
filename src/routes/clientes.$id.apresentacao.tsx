import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchDataset } from "@/lib/data";
import { DreModel, TOTAL, buildDre, ah } from "@/lib/dre";
import { brl, mesLabel, mesLongo, pct } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/clientes/$id/apresentacao")({
  head: () => ({
    meta: [
      { title: "Apresentação de resultados — Diagnóstico Empresarial" },
      {
        name: "description",
        content:
          "Slides prontos para reunião: resultado do período, DRE resumida, desempenho por marketplace e principais produtos.",
      },
      { property: "og:title", content: "Apresentação de resultados" },
      {
        property: "og:description",
        content: "Deck de reunião gerado a partir da DRE Gerencial do cliente.",
      },
    ],
  }),
  component: Apresentacao,
});

function Apresentacao() {
  const { id } = Route.useParams();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<string>(TOTAL);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data } = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => fetchDataset(id),
    enabled: !!session,
  });
  const model = useMemo(() => (data ? new DreModel(data) : null), [data]);

  if (!model) {
    return (
      <div className="diag-container">
        <p className="table-note">Carregando…</p>
      </div>
    );
  }

  const m = model.metrics(periodo);
  const idx = model.meses.indexOf(periodo);
  const anterior = idx > 0 ? model.metrics(model.meses[idx - 1]!) : null;
  const titulo = periodo === TOTAL ? "Período completo" : mesLongo(periodo);

  const porMarketplace = model.marketplaces
    .map((mk) => ({
      nome: mk,
      m: model.metrics(periodo, { marketplace: mk }, false),
    }))
    .sort((a, b) => b.m.faturamento - a.m.faturamento);

  const dre = buildDre(model, { detalhe: "nenhum", completo: true }).filter(
    (l) => l.kind === "synth",
  );

  const produtos = (() => {
    const map = new Map<string, { sku: string; nome: string; margem: number; receita: number }>();
    for (const v of model.vendasDoPeriodo(periodo)) {
      const despVar =
        v.tarifa_venda + v.tarifa_envio - v.receita_envio + v.cupom + v.comissao_afiliado + v.frete_entrega_direta;
      const margem = v.receita - (v.custo ?? 0) - despVar;
      const atual = map.get(v.sku);
      if (atual) {
        atual.margem += margem;
        atual.receita += v.receita;
      } else {
        map.set(v.sku, { sku: v.sku, nome: v.nome_produto, margem, receita: v.receita });
      }
    }
    const arr = Array.from(map.values());
    return {
      melhores: [...arr].sort((a, b) => b.margem - a.margem).slice(0, 5),
      piores: [...arr].sort((a, b) => a.margem - b.margem).slice(0, 5),
    };
  })();

  const delta = (key: "faturamento" | "margemContribuicao" | "lucroLiquido") =>
    anterior ? ah(m[key] as number | null, anterior[key] as number | null) : null;

  return (
    <div className="apresentacao">
      <div className="apres-bar no-print">
        <Link to="/clientes/$id" params={{ id }} className="btn ghost">
          ← Voltar ao painel
        </Link>
        <div className="field">
          <label>Período da apresentação</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {model.periodos().map((p) => (
              <option key={p} value={p}>
                {p === TOTAL ? "Período Total" : mesLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn primary" onClick={() => window.print()}>
          Imprimir / Salvar em PDF
        </button>
      </div>

      <section className="slide slide-capa">
        <span className="slide-kicker">Diagnóstico Empresarial</span>
        <h1>{model.data.cliente.nome}</h1>
        <p className="slide-subtitle">DRE Gerencial — {titulo}</p>
        <p className="slide-footer">Preparado por Ecommtabil</p>
      </section>

      <section className="slide">
        <span className="slide-kicker">Resultado do período</span>
        <h2>Como o negócio performou</h2>
        <div className="slide-stats">
          <div className="slide-stat">
            <span>Faturamento</span>
            <strong>{brl(m.faturamento)}</strong>
            {delta("faturamento") !== null && (
              <em className={delta("faturamento")! >= 0 ? "ah-pos" : "ah-neg"}>
                {pct(delta("faturamento"))} vs. mês anterior
              </em>
            )}
          </div>
          <div className="slide-stat">
            <span>Margem de Contribuição</span>
            <strong>{brl(m.margemContribuicao)}</strong>
            <em>{pct(m.margemContribuicaoPct)} do faturamento</em>
          </div>
          <div className="slide-stat">
            <span>Lucro Líquido</span>
            <strong className={(m.lucroLiquido ?? 0) >= 0 ? "ah-pos" : "ah-neg"}>
              {brl(m.lucroLiquido)}
            </strong>
            <em>Margem líquida {pct(m.margemLiquidaPct)}</em>
          </div>
        </div>
        <p className="slide-note">
          Ponto de equilíbrio do período: <strong>{brl(m.pontoEquilibrio)}</strong> de
          faturamento — abaixo disso a operação opera no prejuízo.
        </p>
      </section>

      <section className="slide">
        <span className="slide-kicker">DRE Gerencial resumida</span>
        <h2>Da venda ao lucro</h2>
        <table className="slide-table">
          <tbody>
            {dre.map((l) => (
              <tr key={l.key}>
                <td>{l.label}</td>
                <td className="num">
                  {l.values[periodo] === null || l.values[periodo] === undefined ? (
                    <span className="na">N/D</span>
                  ) : (
                    brl(l.values[periodo]!)
                  )}
                </td>
                <td className="num">
                  {m.faturamento
                    ? pct(((l.values[periodo] ?? 0) / m.faturamento) * 100)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="slide">
        <span className="slide-kicker">Canais de venda</span>
        <h2>Desempenho por marketplace</h2>
        <table className="slide-table">
          <thead>
            <tr>
              <th>Marketplace</th>
              <th className="num">Faturamento</th>
              <th className="num">Participação</th>
              <th className="num">Margem de Contribuição</th>
              <th className="num">MC %</th>
            </tr>
          </thead>
          <tbody>
            {porMarketplace.map((r) => (
              <tr key={r.nome}>
                <td>{r.nome}</td>
                <td className="num">{brl(r.m.faturamento)}</td>
                <td className="num">
                  {pct(m.faturamento ? (r.m.faturamento / m.faturamento) * 100 : null)}
                </td>
                <td className="num">{brl(r.m.margemContribuicao)}</td>
                <td className="num">{pct(r.m.margemContribuicaoPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="slide-note">
          Imposto e despesas fixas não são rastreados por canal, então a cascata
          por marketplace vai até a Margem de Contribuição.
        </p>
      </section>

      <section className="slide">
        <span className="slide-kicker">Produtos</span>
        <h2>Onde está a margem</h2>
        <div className="slide-cols">
          <div>
            <h3>Maiores margens</h3>
            <table className="slide-table">
              <tbody>
                {produtos.melhores.map((p) => (
                  <tr key={p.sku}>
                    <td>{p.nome || p.sku}</td>
                    <td className="num ah-pos">{brl(p.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Atenção imediata</h3>
            <table className="slide-table">
              <tbody>
                {produtos.piores.map((p) => (
                  <tr key={p.sku}>
                    <td>{p.nome || p.sku}</td>
                    <td className={`num ${p.margem >= 0 ? "" : "ah-neg"}`}>{brl(p.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="slide slide-capa">
        <span className="slide-kicker">Próximos passos</span>
        <h2>Plano de ação</h2>
        <ul className="slide-list">
          <li>Revisar preço e custo dos SKUs com margem negativa.</li>
          <li>
            Concentrar investimento nos canais com melhor margem de contribuição.
          </li>
          <li>
            Manter faturamento acima do ponto de equilíbrio de {brl(m.pontoEquilibrio)}.
          </li>
          <li>Cadastrar custos faltantes para fechar a análise por produto.</li>
        </ul>
        <p className="slide-footer">Preparado por Ecommtabil</p>
      </section>
    </div>
  );
}

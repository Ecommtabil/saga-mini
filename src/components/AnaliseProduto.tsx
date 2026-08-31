import { useMemo, useState } from "react";
import { TOTAL, type DreModel } from "@/lib/dre";
import { brl, num, pct } from "@/lib/format";

type Linha = {
  key: string;
  sku: string;
  produto: string;
  fornecedor: string;
  marketplace: string;
  empresa: string;
  unidades: number;
  receita: number;
  custo: number | null;
  despVar: number;
  margem: number;
  margemPct: number | null;
};

export function AnaliseProduto({
  model,
  periodo,
}: {
  model: DreModel;
  periodo: string;
}) {
  const [busca, setBusca] = useState("");
  const [skuSel, setSkuSel] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [marketplace, setMarketplace] = useState("");
  const [situacao, setSituacao] = useState("");
  const [ordem, setOrdem] = useState<"maior" | "menor">("maior");

  const empresaNome = useMemo(
    () => new Map(model.data.empresas.map((e) => [e.id, e.nome])),
    [model],
  );

  const linhas = useMemo<Linha[]>(() => {
    const rows = model.vendasDoPeriodo(periodo);
    const map = new Map<string, Linha>();
    for (const v of rows) {
      const key = `${v.empresa_id}|${v.marketplace}|${v.sku}`;
      const despVar =
        v.tarifa_venda +
        v.tarifa_envio -
        v.receita_envio +
        v.cupom +
        v.comissao_afiliado +
        v.frete_entrega_direta;
      const atual = map.get(key);
      if (!atual) {
        map.set(key, {
          key,
          sku: v.sku,
          produto: v.nome_produto,
          fornecedor: v.fornecedor ?? "—",
          marketplace: v.marketplace,
          empresa: empresaNome.get(v.empresa_id) ?? "—",
          unidades: v.unidades,
          receita: v.receita,
          custo: v.custo,
          despVar,
          margem: 0,
          margemPct: null,
        });
      } else {
        atual.unidades += v.unidades;
        atual.receita += v.receita;
        atual.custo =
          v.custo === null && atual.custo === null
            ? null
            : (atual.custo ?? 0) + (v.custo ?? 0);
        atual.despVar += despVar;
      }
    }
    return Array.from(map.values()).map((l) => {
      const margem = l.receita - (l.custo ?? 0) - l.despVar;
      return {
        ...l,
        margem,
        margemPct: l.receita > 0 ? (margem / l.receita) * 100 : null,
      };
    });
  }, [model, periodo, empresaNome]);

  const fornecedores = Array.from(new Set(linhas.map((l) => l.fornecedor))).sort();
  const canais = Array.from(new Set(linhas.map((l) => l.marketplace))).sort();

  const filtradas = linhas
    .filter((l) => {
      const q = busca.trim().toLowerCase();
      if (q && !`${l.sku} ${l.produto}`.toLowerCase().includes(q)) return false;
      if (skuSel && l.sku !== skuSel) return false;
      if (fornecedor && l.fornecedor !== fornecedor) return false;
      if (marketplace && l.marketplace !== marketplace) return false;
      if (situacao === "nd" && l.custo !== null) return false;
      if (situacao === "pos" && !(l.custo !== null && l.margem >= 0)) return false;
      if (situacao === "neg" && !(l.custo !== null && l.margem < 0)) return false;
      return true;
    })
    .sort((a, b) => (ordem === "maior" ? b.margem - a.margem : a.margem - b.margem));

  const skus = Array.from(new Set(linhas.map((l) => l.sku))).sort();
  const idx = skuSel ? skus.indexOf(skuSel) : -1;

  const totais = filtradas.reduce(
    (acc, l) => ({
      unidades: acc.unidades + l.unidades,
      receita: acc.receita + l.receita,
      custo: acc.custo + (l.custo ?? 0),
      despVar: acc.despVar + l.despVar,
      margem: acc.margem + l.margem,
    }),
    { unidades: 0, receita: 0, custo: 0, despVar: 0, margem: 0 },
  );

  return (
    <section className="panel bleed">
      <h2>
        Análise por Produto —{" "}
        {periodo === TOTAL ? "Período Total" : `mês selecionado`}
      </h2>
      <div className="filters">
        <div className="field">
          <label>Busca (SKU ou nome)</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />
        </div>
        <div className="field">
          <label>Produto específico</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              className="nav-arrow"
              disabled={idx <= 0}
              onClick={() => setSkuSel(skus[idx - 1] ?? "")}
            >
              ‹
            </button>
            <select value={skuSel} onChange={(e) => setSkuSel(e.target.value)}>
              <option value="">Todos os produtos</option>
              {skus.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              className="nav-arrow"
              disabled={idx < 0 || idx >= skus.length - 1}
              onClick={() => setSkuSel(skus[idx + 1] ?? "")}
            >
              ›
            </button>
          </div>
        </div>
        <div className="field">
          <label>Fornecedor</label>
          <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
            <option value="">Todos</option>
            {fornecedores.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Marketplace</label>
          <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
            <option value="">Todos</option>
            {canais.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Situação</label>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">Todas</option>
            <option value="pos">Margem positiva</option>
            <option value="neg">Margem negativa</option>
            <option value="nd">Custo não cadastrado</option>
          </select>
        </div>
        <div className="field">
          <label>Ordenar por margem</label>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as "maior" | "menor")}>
            <option value="maior">Maior primeiro</option>
            <option value="menor">Menor primeiro</option>
          </select>
        </div>
        <div className="count">
          {filtradas.length} de {linhas.length} produtos
        </div>
      </div>

      <div className="wide-table-wrap">
        <table className="prod-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Fornecedor</th>
              <th>Empresa</th>
              <th>Marketplace</th>
              <th className="num">Unidades</th>
              <th className="num">Receita</th>
              <th className="num">Custo</th>
              <th className="num">Desp. Variáveis</th>
              <th className="num">Margem (R$)</th>
              <th className="num">Margem (%)</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => {
              const largura = Math.min(Math.abs(l.margemPct ?? 0), 100) * 0.7;
              return (
                <tr key={l.key}>
                  <td>{l.sku}</td>
                  <td>
                    <span className="produto-cell" title={l.produto}>
                      {l.produto}
                    </span>
                  </td>
                  <td>{l.fornecedor}</td>
                  <td>{l.empresa}</td>
                  <td>{l.marketplace}</td>
                  <td className="num">{num(l.unidades)}</td>
                  <td className="num">{brl(l.receita)}</td>
                  <td className="num">
                    {l.custo === null ? <span className="na">N/D</span> : brl(l.custo)}
                  </td>
                  <td className="num">{brl(l.despVar)}</td>
                  <td className="num">{brl(l.margem)}</td>
                  <td className="num">
                    <span className="margin-bar-wrap">
                      <span
                        className="margin-bar"
                        style={{
                          width: `${largura}px`,
                          background: (l.margemPct ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                        }}
                      />
                    </span>
                    {pct(l.margemPct)}
                  </td>
                  <td>
                    {l.custo === null ? (
                      <span className="tag nd">Custo não cadastrado</span>
                    ) : l.margem >= 0 ? (
                      <span className="tag ok">Margem positiva</span>
                    ) : (
                      <span className="tag neg">Margem negativa</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>Total filtrado</td>
              <td className="num">{num(totais.unidades)}</td>
              <td className="num">{brl(totais.receita)}</td>
              <td className="num">{brl(totais.custo)}</td>
              <td className="num">{brl(totais.despVar)}</td>
              <td className="num">{brl(totais.margem)}</td>
              <td className="num">
                {pct(totais.receita > 0 ? (totais.margem / totais.receita) * 100 : null)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="table-note">
        A margem por produto é Receita − Custo − Despesas Variáveis. Imposto
        Simples Nacional e despesas fixas não são rateados por SKU.
      </p>
    </section>
  );
}

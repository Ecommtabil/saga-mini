import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DreModel } from "@/lib/dre";
import { brl, mesLabel, num, pct } from "@/lib/format";
import { AnaliseMargem } from "./AnaliseMargem";

type Agg = { q: number; r: number; nome: string };

function agrupar(model: DreModel, mes: string, empresaId: string, mk: string) {
  const map = new Map<string, Agg>();
  for (const v of model.vendasDoPeriodo(mes)) {
    if (empresaId && v.empresa_id !== empresaId) continue;
    if (mk && v.marketplace !== mk) continue;
    const a = map.get(v.sku) ?? { q: 0, r: 0, nome: v.nome_produto };
    a.q += v.unidades;
    a.r += v.receita;
    map.set(v.sku, a);
  }
  return map;
}

export function AnalisePVM({ model }: { model: DreModel }) {
  const meses = model.meses;
  const [base, setBase] = useState(meses[meses.length - 2] ?? meses[0] ?? "");
  const [atual, setAtual] = useState(meses[meses.length - 1] ?? "");
  const [empresaId, setEmpresaId] = useState("");
  const [mk, setMk] = useState("");

  const r = useMemo(() => {
    const b = agrupar(model, base, empresaId, mk);
    const a = agrupar(model, atual, empresaId, mk);
    // Mix e volume calculados sobre SKUs presentes nos dois meses.
    const comuns = [...a.keys()].filter((k) => (b.get(k)?.q ?? 0) > 0 && (a.get(k)?.q ?? 0) > 0);
    const q0c = comuns.reduce((s, k) => s + (b.get(k)?.q ?? 0), 0);
    const q1c = comuns.reduce((s, k) => s + (a.get(k)?.q ?? 0), 0);
    let volume = 0, mix = 0, preco = 0;
    const linhas = comuns.flatMap((k) => {
      const x0 = b.get(k), x1 = a.get(k);
      if (!x0 || !x1) return [];
      const p0 = x0.r / x0.q, p1 = x1.r / x1.q;
      const mix0 = q0c ? x0.q / q0c : 0;
      const ev = (q1c * mix0 - x0.q) * p0;
      const em = (x1.q - q1c * mix0) * p0;
      const ep = (p1 - p0) * x1.q;
      volume += ev; mix += em; preco += ep;
      return [{ sku: k, nome: x1.nome, q0: x0.q, q1: x1.q, p0, p1, ev, em, ep, total: x1.r - x0.r }];
    });
    let novos = 0, perdidos = 0;
    for (const [k, x] of a) if (!((b.get(k)?.q ?? 0) > 0 && x.q > 0)) novos += x.r;
    for (const [k, x] of b) if (!((a.get(k)?.q ?? 0) > 0 && x.q > 0)) perdidos -= x.r;
    const r0 = [...b.values()].reduce((s, x) => s + x.r, 0);
    const r1 = [...a.values()].reduce((s, x) => s + x.r, 0);
    linhas.sort((x, y) => Math.abs(y.total) - Math.abs(x.total));
    return { r0, r1, volume, mix, preco, novos, perdidos, linhas };
  }, [model, base, atual, empresaId, mk]);

  if (meses.length < 2) {
    return <section className="panel"><p className="empty-state">É preciso ter pelo menos dois meses importados para a análise de Preço, Volume e Mix.</p></section>;
  }

  // Cascata: barras flutuantes [início, fim]
  const passos: [string, number][] = [
    ["Volume", r.volume], ["Preço", r.preco], ["Mix", r.mix],
    ["Novos SKUs", r.novos], ["SKUs perdidos", r.perdidos],
  ];
  let acc = r.r0;
  const cascata = [
    { nome: `Receita ${mesLabel(base)}`, faixa: [0, r.r0], v: r.r0, tipo: "total" },
    ...passos.map(([nome, v]) => {
      const ini = acc; acc += v;
      return { nome, faixa: [Math.min(ini, acc), Math.max(ini, acc)], v, tipo: v >= 0 ? "pos" : "neg" };
    }),
    { nome: `Receita ${mesLabel(atual)}`, faixa: [0, r.r1], v: r.r1, tipo: "total" },
  ];
  const cor = (t: string) => (t === "total" ? "var(--blue-med)" : t === "pos" ? "var(--green)" : "var(--red)");
  const sel = (v: number) => <span className={v >= 0 ? "ah-pos" : "ah-neg"}>{brl(v)}</span>;

  return (
    <>
      <section className="panel bleed">
        <h2>Análise de Preço, Volume e Mix (receita)</h2>
        <div className="filters">
          <div className="field">
            <label>Mês base</label>
            <select aria-label="Mês base" value={base} onChange={(e) => setBase(e.target.value)}>
              {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Mês comparado</label>
            <select aria-label="Mês comparado" value={atual} onChange={(e) => setAtual(e.target.value)}>
              {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Empresa</label>
            <select aria-label="Empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              <option value="">Consolidado</option>
              {model.data.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Marketplace</label>
            <select aria-label="Marketplace" value={mk} onChange={(e) => setMk(e.target.value)}>
              <option value="">Todos</option>
              {model.marketplaces.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="wide-table-wrap">
          <table className="prod-table">
            <thead><tr>
              <th className="num">Receita {mesLabel(base)}</th>
              <th className="num">Efeito Volume</th>
              <th className="num">Efeito Preço</th>
              <th className="num">Efeito Mix</th>
              <th className="num">Novos SKUs</th>
              <th className="num">SKUs perdidos</th>
              <th className="num">Receita {mesLabel(atual)}</th>
              <th className="num">Variação</th>
            </tr></thead>
            <tbody><tr>
              <td className="num">{brl(r.r0)}</td>
              <td className="num">{sel(r.volume)}</td>
              <td className="num">{sel(r.preco)}</td>
              <td className="num">{sel(r.mix)}</td>
              <td className="num">{sel(r.novos)}</td>
              <td className="num">{sel(r.perdidos)}</td>
              <td className="num">{brl(r.r1)}</td>
              <td className="num">{sel(r.r1 - r.r0)} ({pct(r.r0 ? ((r.r1 - r.r0) / r.r0) * 100 : null)})</td>
            </tr></tbody>
          </table>
        </div>

        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cascata} margin={{ top: 16, right: 24, bottom: 8, left: 24 }}>
              <CartesianGrid stroke="var(--blue-pale)" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => brl(v as number).replace(",00", "")} tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(_, __, p) => brl((p.payload as { v: number }).v)} />
              <Bar dataKey="faixa" name="Valor">
                {cascata.map((c, i) => <Cell key={i} fill={cor(c.tipo)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="muted">
          <strong>Volume:</strong> efeito de vender mais ou menos unidades no total, mantendo o mix e os preços do mês base.{" "}
          <strong>Preço:</strong> efeito da mudança do preço médio de cada SKU.{" "}
          <strong>Mix:</strong> efeito de vender proporcionalmente mais produtos caros ou baratos.{" "}
          SKUs vendidos em só um dos meses aparecem como "Novos" ou "Perdidos".
        </p>
      </section>

      <section className="panel bleed">
        <h2>Detalhe por SKU (vendidos nos dois meses)</h2>
        <div className="wide-table-wrap">
          <table className="prod-table">
            <thead><tr>
              <th>SKU</th><th>Produto</th>
              <th className="num">Qtd {mesLabel(base)}</th><th className="num">Qtd {mesLabel(atual)}</th>
              <th className="num">Preço médio {mesLabel(base)}</th><th className="num">Preço médio {mesLabel(atual)}</th>
              <th className="num">Volume</th><th className="num">Preço</th><th className="num">Mix</th><th className="num">Variação</th>
            </tr></thead>
            <tbody>
              {r.linhas.map((l) => (
                <tr key={l.sku}>
                  <td>{l.sku}</td>
                  <td><span className="produto-cell" title={l.nome}>{l.nome}</span></td>
                  <td className="num">{num(l.q0)}</td><td className="num">{num(l.q1)}</td>
                  <td className="num">{brl(l.p0)}</td><td className="num">{brl(l.p1)}</td>
                  <td className="num">{sel(l.ev)}</td><td className="num">{sel(l.ep)}</td>
                  <td className="num">{sel(l.em)}</td><td className="num">{sel(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AnaliseMargem model={model} base={base} atual={atual} empresaId={empresaId} mk={mk} />
    </>
  );
}

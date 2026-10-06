import type { DreModel } from "@/lib/dre";
import { brl, mesLabel, num, pct } from "@/lib/format";
import { profitAnalysis } from "@/lib/profit-analysis";


export function AnaliseMargem({ model, base, atual, empresaId, mk }: {
  model: DreModel; base: string; atual: string; empresaId: string; mk: string;
}) {
  const r = profitAnalysis(model, base, atual, { empresaId, marketplace: mk });
  const titulo = r.liquida ? "Lucro líquido" : "Margem de contribuição";
  const delta = r.lucro0 !== null && r.lucro1 !== null ? r.lucro1 - r.lucro0 : null;
  const pp = r.margem0 !== null && r.margem1 !== null ? r.margem1 - r.margem0 : null;
  const efeitosAtivos = r.efeitos.filter(([, v]) => Math.abs(v) > 0.000001);
  const maior = efeitosAtivos.length
    ? efeitosAtivos.reduce((m, e) => (Math.abs(e[1]) > Math.abs(m[1]) ? e : m))
    : null;
  const saldo = (v: number | null) => <span className={v === null ? "na" : v >= 0 ? "ah-pos" : "ah-neg"}>{brl(v)}</span>;
  return <section className="panel bleed">
    <h2>O que explica a margem de lucro?</h2>
    <div className="wide-table-wrap">
      <table className="prod-table">
        <thead><tr><th>Indicador</th><th className="num">{mesLabel(base)}</th><th className="num">{mesLabel(atual)}</th><th className="num">Variação</th></tr></thead>
        <tbody>
          <tr><td>Faturamento</td><td className="num">{brl(r.b.faturamento)}</td><td className="num">{brl(r.a.faturamento)}</td><td className="num">{saldo(r.a.faturamento - r.b.faturamento)}</td></tr>
          <tr><td>{titulo}</td><td className="num">{saldo(r.lucro0)}</td><td className="num">{saldo(r.lucro1)}</td><td className="num">{saldo(delta)}</td></tr>
          <tr><td>{r.liquida ? "Margem líquida" : "Margem de contribuição"} (%)</td><td className="num">{pct(r.margem0)}</td><td className="num">{pct(r.margem1)}</td><td className="num">{pp === null ? "N/D" : `${pp > 0 ? "+" : ""}${num(pp, 2)} p.p.`}</td></tr>
        </tbody>
      </table>
    </div>
    <p className="table-note">
      {r.margem1 === null ? "Sem faturamento positivo no mês comparado, não é possível calcular a margem percentual."
        : r.margem1 >= 0 ? `Em ${mesLabel(atual)}, de cada R$ 100,00 vendidos, sobraram ${brl(r.margem1)} ${r.liquida ? "de lucro líquido" : "para cobrir despesas fixas e gerar lucro"}.`
        : `Em ${mesLabel(atual)}, cada R$ 100,00 vendidos geraram ${brl(Math.abs(r.margem1))} de ${r.liquida ? "prejuízo" : "déficit antes das despesas fixas"}.`}
      {pp !== null && ` A margem ${pp > 0 ? "aumentou" : pp < 0 ? "caiu" : "permaneceu estável"}${pp === 0 ? "." : ` ${num(Math.abs(pp), 2)} pontos percentuais em relação a ${mesLabel(base)}.`}`}
    </p>
    <h3>Da variação das vendas à variação do lucro</h3>
    <div className="wide-table-wrap">
      <table className="prod-table">
        <thead><tr><th>Composição</th><th className="num">Impacto no resultado</th></tr></thead>
        <tbody>
          <tr><td>{titulo} — {mesLabel(base)}</td><td className="num">{saldo(r.lucro0)}</td></tr>
          {r.efeitos.filter(([, v]) => Math.abs(v) > 0.000001).map(([nome, v]) => <tr key={nome}><td>{nome}</td><td className="num">{saldo(v)}</td></tr>)}
          <tr><td><strong>{titulo} — {mesLabel(atual)}</strong></td><td className="num"><strong>{saldo(r.lucro1)}</strong></td></tr>
        </tbody>
      </table>
    </div>
    <p className="table-note">Preço, volume e mix explicam a mudança do faturamento acima. Para chegar ao lucro, também entram as mudanças nos custos, no Simples e nas despesas. Aumento de despesa reduz o resultado; redução de despesa aumenta o resultado. A margem percentual é o resultado dividido pelo faturamento × 100: vender mais não garante uma margem maior.</p>
    <p className="table-note">{r.liquida ? "Lucro líquido = Faturamento − Simples − Custo dos produtos − Despesas variáveis − Despesas fixas. Na seleção de empresa, entram apenas as despesas fixas vinculadas à própria loja; no consolidado, entram também as do grupo." : "Por marketplace, a análise mostra a contribuição após o Simples, sem despesas fixas: elas não são atribuídas por canal e não são rateadas aqui."} O Simples usa a alíquota parametrizada de cada empresa em cada mês.</p>
    {r.semCusto > 0 && <p className="table-note ah-neg">Atenção: {num(r.semCusto)} linhas de vendas sem custo cadastrado nos meses selecionados. Seus custos estão ausentes do cálculo; lucro e margem podem estar superestimados.</p>}
  </section>;
}
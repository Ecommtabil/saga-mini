import { useMemo, useState } from "react";
import { TOTAL, ah, type DreLine, type DreModel } from "@/lib/dre";
import { brl, mesLabel, pct } from "@/lib/format";

type Props = {
  model: DreModel;
  lines: DreLine[];
  nota?: string;
};

export function DreWideTable({ model, lines, nota }: Props) {
  const [modo, setModo] = useState<"AV" | "AH">("AV");
  const [colapsados, setColapsados] = useState<Set<string>>(
    () => new Set(lines.filter((l) => l.kind === "synth").map((l) => l.key)),
  );
  const periodos = model.periodos();

  const faturamento = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of periodos) map[p] = model.metrics(p).faturamento;
    return map;
  }, [model, periodos.join("|")]);

  const toggle = (key: string) =>
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const todosSynth = lines.filter((l) => l.kind === "synth").map((l) => l.key);
  const tudoAberto = colapsados.size === 0;

  const visiveis = lines.filter((l) => !l.parent || !colapsados.has(l.parent));

  const segundaColuna = (line: DreLine, periodo: string, idx: number) => {
    const valor = line.values[periodo] ?? null;
    if (modo === "AV") {
      const base = faturamento[periodo] ?? 0;
      if (valor === null || !base) return <span className="na">N/D</span>;
      return <span>{pct((valor / base) * 100)}</span>;
    }
    if (periodo === TOTAL) return <span className="na">N/D</span>;
    const anterior = idx > 0 ? (line.values[periodos[idx - 1]!] ?? null) : null;
    const v = ah(valor, anterior);
    if (v === null) return <span className="na">N/D</span>;
    return <span className={v >= 0 ? "ah-pos" : "ah-neg"}>{pct(v)}</span>;
  };

  return (
    <>
      <div className="toolbar no-print">
        <button
          className={modo === "AV" ? "active" : ""}
          onClick={() => setModo("AV")}
        >
          AV % (vertical)
        </button>
        <button
          className={modo === "AH" ? "active" : ""}
          onClick={() => setModo("AH")}
        >
          AH % (horizontal)
        </button>
        <button
          onClick={() =>
            setColapsados(tudoAberto ? new Set(todosSynth) : new Set())
          }
        >
          {tudoAberto ? "Recolher tudo" : "Expandir tudo"}
        </button>
      </div>

      <div className="wide-table-wrap">
        <table className="wide-dre">
          <thead>
            <tr>
              <th rowSpan={2}>Conta</th>
              {periodos.map((p) => (
                <th className="group-head" colSpan={2} key={p}>
                  {p === TOTAL ? "Período Total" : mesLabel(p)}
                </th>
              ))}
            </tr>
            <tr>
              {periodos.map((p) => [
                <th className="sub-head" key={`${p}-r`}>
                  Realizado
                </th>,
                <th className="sub-head" key={`${p}-a`}>
                  {modo}%
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((line) => {
              const temFilhos = lines.some((l) => l.parent === line.key);
              return (
                <tr
                  key={line.key}
                  className={
                    line.kind === "synth"
                      ? line.reference
                        ? "synth-row ref-row"
                        : "synth-row"
                      : "analytic-row"
                  }
                >
                  <td onClick={() => temFilhos && toggle(line.key)}>
                    {line.kind === "synth" && temFilhos && (
                      <span className="toggle-icon">
                        {colapsados.has(line.key) ? "+" : "−"}
                      </span>
                    )}
                    {line.label}
                  </td>
                  {periodos.map((p, idx) => [
                    <td key={`${p}-r`}>
                      {line.values[p] === null || line.values[p] === undefined ? (
                        <span className="na">N/D</span>
                      ) : (
                        brl(line.values[p])
                      )}
                    </td>,
                    <td key={`${p}-a`}>{segundaColuna(line, p, idx)}</td>,
                  ])}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nota && <p className="table-note">{nota}</p>}
      <p className="table-note">
        Margem de Contribuição = Lucro Bruto − Despesas Variáveis (antes das
        despesas fixas). Ponto de Equilíbrio = Despesas Fixas ÷ (Margem de
        Contribuição ÷ Faturamento); quando a margem de contribuição é ≤ 0 o
        equilíbrio não é alcançável por volume e a célula mostra "N/D".
      </p>
    </>
  );
}

import { useRef, useState } from "react";
import { toast } from "sonner";
import { salvarAliquota, salvarDespesasFixas } from "@/lib/data";
import { mesLabel } from "@/lib/format";
import { baixarModeloDespesas, lerDespesasFixas } from "@/lib/importPlanilha";
import type { DreModel } from "@/lib/dre";

export function ParametrosModal({
  model,
  mesInicial,
  onClose,
  onSalvo,
}: {
  model: DreModel;
  mesInicial: string;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const meses = model.meses.length ? model.meses : [mesInicial];
  const [mes, setMes] = useState(meses.includes(mesInicial) ? mesInicial : meses[0]!);
  const [empresaId, setEmpresaId] = useState<string | "GRUPO">("GRUPO");
  /** Escopo da alíquota: "GERAL" (todas) ou o id de uma empresa. */
  const [aliqEscopo, setAliqEscopo] = useState<string>("GERAL");
  const [aliquota, setAliquota] = useState(String(model.aliquota(mes)));
  const [itens, setItens] = useState(
    model
      .fixasDoMes(mes, null)
      .filter((f) => f.empresa_id === null)
      .map((f) => ({ nome: f.nome, valor: String(f.valor) })),
  );

  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const importarDespesas = async (file: File) => {
    try {
      const lidas = await lerDespesasFixas(file);
      if (!lidas.length) {
        toast.error("Nenhuma despesa encontrada na planilha.");
        return;
      }
      setItens((arr) => {
        const base = arr.filter((i) => i.nome.trim());
        const idx = new Map(base.map((i, j) => [i.nome.trim().toLowerCase(), j]));
        const out = [...base];
        for (const d of lidas) {
          const k = d.nome.toLowerCase();
          const j = idx.get(k);
          if (j !== undefined) out[j] = { nome: d.nome, valor: String(d.valor) };
          else {
            idx.set(k, out.length);
            out.push({ nome: d.nome, valor: String(d.valor) });
          }
        }
        return out;
      });
      toast.success(
        `${lidas.length} despesa(s) carregadas para ${mesLabel(mes)}. Clique em Salvar para gravar.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler a planilha.");
    }
  };

  const recarregar = (novoMes: string, novaEmpresa: string, escopo = aliqEscopo) => {
    setMes(novoMes);
    setEmpresaId(novaEmpresa as string);
    setAliqEscopo(escopo);
    setAliquota(
      String(model.aliquota(novoMes, escopo === "GERAL" ? null : escopo)),
    );
    setItens(
      model
        .fixasDoMes(novoMes, novaEmpresa === "GRUPO" ? null : novaEmpresa)
        .filter((f) =>
          novaEmpresa === "GRUPO" ? f.empresa_id === null : f.empresa_id === novaEmpresa,
        )
        .map((f) => ({ nome: f.nome, valor: String(f.valor) })),
    );
  };

  const aliqPropria =
    aliqEscopo !== "GERAL" &&
    model.data.parametros.some(
      (p) => p.mes === mes && p.empresa_id === aliqEscopo,
    );

  const salvar = async () => {
  const salvar = async () => {
    if (!mes) {
      toast.error("Selecione a competência (mês) antes de salvar.");
      return;
    }
    setSalvando(true);
    try {

      await salvarAliquota(
        model.data.cliente.id,
        mes,
        Number(aliquota) || 0,
        aliqEscopo === "GERAL" ? null : aliqEscopo,
      );
      await salvarDespesasFixas(
        model.data.cliente.id,
        mes,
        empresaId === "GRUPO" ? null : empresaId,
        itens.map((i) => ({ nome: i.nome, valor: Number(i.valor) || 0 })),
      );
      toast.success(`Parâmetros de ${mesLabel(mes)} salvos.`);
      onSalvo();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const totalFixas = itens.reduce((a, i) => a + (Number(i.valor) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Parâmetros do mês</h3>
        <div className="field">
          <label>Mês</label>
          <select value={mes} onChange={(e) => recarregar(e.target.value, empresaId)}>
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesLabel(m)}
              </option>
            ))}
          </select>
        </div>
        {model.data.empresas.length > 0 && (
          <div className="field">
            <label>Alíquota aplicada a</label>
            <select
              value={aliqEscopo}
              onChange={(e) => recarregar(mes, empresaId, e.target.value)}
            >
              <option value="GERAL">Geral (todas as empresas)</option>
              {model.data.empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>Alíquota do Simples Nacional (%)</label>
          <input
            type="number"
            step="0.01"
            value={aliquota}
            onChange={(e) => setAliquota(e.target.value)}
          />
          <p className="modal-note">
            {aliqEscopo === "GERAL"
              ? "Vale para todas as empresas que não tiverem alíquota própria neste mês."
              : aliqPropria
                ? "Alíquota própria desta empresa neste mês."
                : "Esta empresa ainda usa a alíquota geral; salvar aqui cria a alíquota própria dela."}{" "}
            Não afeta as despesas fixas nem os outros parâmetros.
          </p>
        </div>

        <hr className="modal-sep" />
        <h3>Despesas fixas de {mesLabel(mes)}</h3>
        {model.data.empresas.length > 1 && (
          <div className="field">
            <label>Atribuição</label>
            <select
              value={empresaId}
              onChange={(e) => recarregar(mes, e.target.value)}
            >
              <option value="GRUPO">Grupo (todas as empresas)</option>
              {model.data.empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        {itens.map((it, i) => (
          <div className="despfix-row" key={i}>
            <input
              placeholder="Nome da despesa"
              value={it.nome}
              onChange={(e) =>
                setItens((arr) =>
                  arr.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)),
                )
              }
            />
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={it.valor}
              onChange={(e) =>
                setItens((arr) =>
                  arr.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)),
                )
              }
            />
            <button
              className="despfix-remove"
              onClick={() => setItens((arr) => arr.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importarDespesas(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileRef.current?.click()}>
            Importar planilha de despesa fixa
          </button>
          <button className="ghost" onClick={() => baixarModeloDespesas()}>
            Baixar modelo
          </button>
        </div>
        <button
          className="add-despfix-btn"
          onClick={() => setItens((arr) => [...arr, { nome: "", valor: "" }])}
        >
          + Adicionar despesa fixa
        </button>
        <p className="modal-note" style={{ marginTop: 12 }}>
          Total desta lista: {totalFixas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.
          A visão consolidada da DRE soma as listas de todas as empresas mais as
          despesas do grupo. Despesa fixa não é rastreada por marketplace.
        </p>

        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

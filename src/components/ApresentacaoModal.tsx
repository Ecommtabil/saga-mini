import { useState } from "react";
import { toast } from "sonner";
import { TOTAL, type DreModel } from "@/lib/dre";
import { mesCompetencia, mesLabel } from "@/lib/format";
import { exportarApresentacao } from "@/lib/pptx";

export function ApresentacaoModal({
  model,
  onClose,
}: {
  model: DreModel;
  onClose: () => void;
}) {
  const periodos = model.periodos();
  const inicial = model.meses.length ? model.meses[model.meses.length - 1]! : TOTAL;
  const [periodo, setPeriodo] = useState(inicial);
  const [competencia, setCompetencia] = useState(
    inicial === TOTAL ? "Período completo" : mesCompetencia(inicial),
  );
  const [gerando, setGerando] = useState(false);

  const trocarPeriodo = (p: string) => {
    setPeriodo(p);
    setCompetencia(p === TOTAL ? "Período completo" : mesCompetencia(p));
  };

  const gerar = async () => {
    setGerando(true);
    try {
      await exportarApresentacao(model, periodo, competencia.trim() || "Período");
      toast.success("Apresentação em PowerPoint gerada.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a apresentação.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Apresentação em PowerPoint</h3>
        <div className="field">
          <label>Competência da reunião</label>
          <select value={periodo} onChange={(e) => trocarPeriodo(e.target.value)}>
            {periodos.map((p) => (
              <option key={p} value={p}>
                {p === TOTAL ? "Período Total" : mesLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Texto da capa (competência)</label>
          <input
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            placeholder="Setembro 2026"
          />
        </div>
        <p className="modal-note">
          A capa será:{" "}
          <strong>
            DIAGNÓSTICO EMPRESARIAL {model.data.cliente.nome.toUpperCase()},{" "}
            {(competencia || "").toUpperCase()}
          </strong>
        </p>
        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={gerando} onClick={() => void gerar()}>
            {gerando ? "Gerando…" : "Exportar PowerPoint"}
          </button>
        </div>
      </div>
    </div>
  );
}

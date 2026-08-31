import { useState } from "react";
import { toast } from "sonner";
import {
  CAMPOS,
  autoMapear,
  baixarModelo,
  converter,
  lerArquivo,
  type Mapeamento,
  type Planilha,
} from "@/lib/importPlanilha";
import { importarLinhas } from "@/lib/data";
import { mesLabel } from "@/lib/format";

export function ImportModal({
  clienteId,
  onClose,
  onImportado,
}: {
  clienteId: string;
  onClose: () => void;
  onImportado: () => void;
}) {
  const [planilha, setPlanilha] = useState<Planilha | null>(null);
  const [map, setMap] = useState<Mapeamento>({});
  const [salvando, setSalvando] = useState(false);

  const escolherArquivo = async (file: File) => {
    try {
      const p = await lerArquivo(file);
      if (!p.linhas.length) {
        toast.error("A planilha está vazia.");
        return;
      }
      setPlanilha(p);
      setMap(autoMapear(p.colunas));
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const importar = async () => {
    if (!planilha) return;
    const { linhas, erros, semCusto } = converter(planilha, map);
    if (!linhas.length) {
      toast.error("Nenhuma linha válida encontrada.");
      return;
    }
    setSalvando(true);
    try {
      const res = await importarLinhas(clienteId, linhas);
      toast.success(
        `${res.linhas} linhas importadas — meses atualizados: ${res.meses
          .sort()
          .map(mesLabel)
          .join(", ")}.${semCusto ? ` ${semCusto} linha(s) sem custo cadastrado.` : ""}`,
      );
      if (erros.length) toast.warning(`${erros.length} linha(s) ignorada(s).`);
      onImportado();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box lg" onClick={(e) => e.stopPropagation()}>
        <h3>Importar planilha de vendas</h3>
        <p className="modal-note">
          Uma linha por SKU / mês / empresa / marketplace. Importar um novo
          arquivo atualiza apenas os meses presentes nele — os demais meses já
          salvos permanecem intactos. Linhas sem custo não bloqueiam a
          importação: o produto é marcado como "Custo não cadastrado".
        </p>
        <button className="btn" onClick={baixarModelo}>
          ⬇ Baixar modelo (.xlsx)
        </button>
        <div className="field" style={{ marginTop: 16 }}>
          <label>Arquivo (.xlsx / .csv)</label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void escolherArquivo(f);
            }}
          />
        </div>

        {planilha && (
          <>
            <hr className="modal-sep" />
            <p className="modal-note">
              {planilha.linhas.length} linhas lidas. Confirme o mapeamento das
              colunas:
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,1fr)",
                gap: 12,
              }}
            >
              {CAMPOS.map((c) => (
                <div className="field" key={c.key}>
                  <label>
                    {c.label}
                    {"obrigatorio" in c && c.obrigatorio ? " *" : ""}
                  </label>

                  <select
                    value={map[c.key] ?? ""}
                    onChange={(e) =>
                      setMap((m) => ({ ...m, [c.key]: e.target.value || undefined }))
                    }
                  >
                    <option value="">— não usar —</option>
                    {planilha.colunas.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button
            className="primary"
            disabled={!planilha || salvando}
            onClick={() => void importar()}
          >
            {salvando ? "Importando…" : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}

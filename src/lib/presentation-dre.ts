import { buildDre, type DreModel } from "./dre";

/** One consolidated statement followed by one statement per registered store. */
export function presentationDres(model: DreModel, periodo: string) {
  const scopes = [
    { nome: "Consolidado", empresaId: null },
    ...model.data.empresas.map((empresa) => ({ nome: empresa.nome, empresaId: empresa.id })),
  ];
  return scopes.map(({ nome, empresaId }) => {
    const filter = empresaId ? { empresaId } : {};
    const metrics = model.metrics(periodo, filter, true);
    const lines = buildDre(model, { detalhe: "nenhum", completo: true, filter })
      .filter((line) => line.kind === "synth" && !line.reference)
      .map((line) => ({
        key: line.key,
        label: line.key === "LUCRO_LIQUIDO" ? "(=) LUCRO LÍQUIDO" : line.label,
        valor: line.values[periodo] ?? null,
        av: metrics.faturamento && line.values[periodo] != null
          ? (Number(line.values[periodo]) / metrics.faturamento) * 100
          : null,
      }));
    return { nome, empresaId, metrics, lines };
  });
}
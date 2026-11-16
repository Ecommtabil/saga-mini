import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DreModel, TOTAL } from "./dre";
import { presentationDres } from "./presentation-dre";
import type { Dataset, Venda } from "./types";

const venda = (empresa_id: string, mes: string, receita: number): Venda => ({
  id: `${empresa_id}-${mes}`, cliente_id: "cliente", empresa_id, mes, receita,
  marketplace: "Canal", sku: "SKU", nome_produto: "Produto", fornecedor: null,
  unidades: 10, custo: 100, tarifa_venda: 10, tarifa_envio: 0, receita_envio: 0,
  cupom: 0, comissao_afiliado: 0, frete_entrega_direta: 0, cancelamentos: 0,
});
const data: Dataset = {
  cliente: { id: "cliente", nome: "Cliente de teste", aliquota_simples_padrao: 5 },
  empresas: [{ id: "a", cliente_id: "cliente", nome: "Loja A" }, { id: "b", cliente_id: "cliente", nome: "Loja B" }],
  vendas: [venda("a", "2026-09", 1000), venda("b", "2026-09", 2000), venda("a", "2026-10", 500)],
  parametros: [{ id: "p", cliente_id: "cliente", empresa_id: "a", mes: "2026-09", aliquota_simples_pct: 9.43 }],
  fixas: [
    { id: "fa", cliente_id: "cliente", empresa_id: "a", mes: "2026-09", nome: "Fixa", valor: 30 },
    { id: "fg", cliente_id: "cliente", empresa_id: null, mes: "2026-09", nome: "Grupo", valor: 50 },
  ],
};
describe("PowerPoint synthetic statements", () => {
  test("includes one consolidated statement and one per store", () => {
    assert.deepEqual(presentationDres(new DreModel(data), "2026-09").map((d) => d.nome), ["Consolidado", "Loja A", "Loja B"]);
  });
  test("uses the selected month and store revenue for AV", () => {
    const statements = presentationDres(new DreModel(data), "2026-09");
    assert.equal(statements[0]?.metrics.faturamento, 3000);
    assert.equal(statements[1]?.metrics.faturamento, 1000);
    assert.ok(Math.abs(Number(statements[1]?.lines.find((l) => l.key === "DEDUCOES")?.av) - 9.43) < 0.001);
    assert.equal(statements[2]?.metrics.faturamento, 2000);
  });
  test("store profit includes its own tax and fixed expenses, not group expenses", () => {
    const statements = presentationDres(new DreModel(data), "2026-09");
    assert.ok(Math.abs(Number(statements[1]?.metrics.lucroLiquido) - 765.7) < 0.001);
    assert.equal(statements[1]?.metrics.despesasFixas, 30);
    assert.equal(statements[2]?.metrics.despesasFixas, 0);
    assert.equal(statements[0]?.metrics.despesasFixas, 80);
    assert.ok(Math.abs(Number(statements[0]?.metrics.lucroLiquido) - 2505.7) < 0.001);
  });
  test("supports the complete period without analytical detail rows", () => {
    const statements = presentationDres(new DreModel(data), TOTAL);
    assert.equal(statements[0]?.metrics.faturamento, 3500);
    assert.equal(statements[1]?.metrics.faturamento, 1500);
    assert.ok(statements.every((s) => s.lines.length === 9));
  });
});
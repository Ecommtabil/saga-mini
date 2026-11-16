import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DreModel, TOTAL } from "./dre";
import type { Dataset, Venda } from "./types";
import { negativeProductPages, presentationNegativeProducts } from "./presentation-negative-products";

const venda = (sku: string, custo: number, extra: Partial<Venda> = {}): Venda => ({
  id: sku, cliente_id: "c", empresa_id: "a", mes: "2026-09", marketplace: "Canal",
  sku, nome_produto: sku, fornecedor: null, unidades: 1, receita: 100, custo,
  tarifa_venda: 0, tarifa_envio: 0, receita_envio: 0, cupom: 0,
  comissao_afiliado: 0, frete_entrega_direta: 0, cancelamentos: 0, ...extra,
});
const model = (vendas: Venda[]) => new DreModel({
  cliente: { id: "c", nome: "Teste", aliquota_simples_padrao: 5 },
  empresas: [{ id: "a", cliente_id: "c", nome: "Loja A" }, { id: "b", cliente_id: "c", nome: "Loja B" }],
  vendas, fixas: [], parametros: [],
} satisfies Dataset);

describe("negative-margin PowerPoint products", () => {
  test("includes all negative items in ascending monetary margin, excluding zero and positives", () => {
    const m = model([venda("menor", 200), venda("maior", 100), venda("zero", 95), venda("positivo", 10)]);
    const rows = presentationNegativeProducts(m, "2026-09");
    assert.deepEqual(rows.map((r) => [r.sku, r.margem]), [["menor", -105], ["maior", -5]]);
  });
  test("keeps losses separate by store and marketplace for the same SKU", () => {
    const rows = presentationNegativeProducts(model([
      venda("SKU", 200), venda("SKU", 0, { empresa_id: "b" }),
      venda("SKU", 150, { marketplace: "Outro" }),
    ]), TOTAL);
    assert.deepEqual(rows.map((r) => r.margem), [-105, -55]);
  });
  test("uses store/month tax and all net variable expenses", () => {
    const m = model([venda("SKU", 70, { tarifa_venda: 10, tarifa_envio: 6, receita_envio: 2,
      cupom: 3, comissao_afiliado: 4, frete_entrega_direta: 5 })]);
    m.data.parametros.push({ id: "p", cliente_id: "c", empresa_id: "a", mes: "2026-09", aliquota_simples_pct: 9.43 });
    assert.ok(Math.abs(Number(presentationNegativeProducts(m, TOTAL)[0]?.margem) + 5.43) < 0.000001);
  });
  test("cancelled sales contribute no loss and only selected months are included", () => {
    const rows = presentationNegativeProducts(model([
      venda("cancelado", 500, { cancelamentos: 100 }),
      venda("outubro", 200, { mes: "2026-10" }), venda("setembro", 100),
    ]), "2026-09");
    assert.deepEqual(rows.map((r) => r.sku), ["setembro"]);
  });
  test("splits the complete ordered list over multiple pages without missing items", () => {
    const pages = negativeProductPages(model(Array.from({ length: 10 }, (_, i) => venda(`SKU${i}`, 100 + i))), TOTAL);
    assert.deepEqual(pages.map((p) => p.length), [3, 3, 3, 1]);
    assert.deepEqual(pages.flat().map((r) => r.margem), [-14, -13, -12, -11, -10, -9, -8, -7, -6, -5]);
  });
  test("includes negative results with missing cost and marks the incomplete calculation", () => {
    const rows = presentationNegativeProducts(model([venda("SKU", 0, { custo: null, tarifa_venda: 120 })]), TOTAL);
    assert.equal(rows[0]?.margem, -25);
    assert.equal(rows[0]?.custoIncompleto, true);
  });
  test("provides an empty-state page if no products have negative margins", () => {
    assert.deepEqual(negativeProductPages(model([venda("SKU", 10)]), TOTAL), [[]]);
  });
});
import * as XLSX from "xlsx";
import type { LinhaImportada } from "./data";

export const CAMPOS = [
  { key: "mes", label: "Mês", obrigatorio: true, aliases: ["mês", "mes", "periodo", "período"] },
  { key: "empresa", label: "Empresa", aliases: ["empresa", "loja", "cnpj"] },
  { key: "marketplace", label: "Marketplace", aliases: ["marketplace", "canal", "canal de venda"] },
  { key: "sku", label: "SKU", obrigatorio: true, aliases: ["sku", "codigo", "código"] },
  { key: "nome_produto", label: "Produto", aliases: ["produto", "nome do produto", "descricao", "descrição"] },
  { key: "fornecedor", label: "Fornecedor", aliases: ["fornecedor"] },
  { key: "unidades", label: "Unidades", aliases: ["unidades", "quantidade", "qtd"] },
  { key: "receita", label: "Receita", obrigatorio: true, aliases: ["receita", "faturamento", "valor de venda"] },
  { key: "custo", label: "Custo", aliases: ["custo", "cmv", "custo do produto"] },
  { key: "tarifa_venda", label: "Tarifa de Venda", aliases: ["tarifa de venda", "comissao", "comissão", "tarifa venda"] },
  { key: "tarifa_envio", label: "Tarifa de Envio", aliases: ["tarifa de envio", "tarifa envio", "frete"] },
  { key: "receita_envio", label: "Receita por Envio", aliases: ["receita por envio", "receita envio"] },
  { key: "cupom", label: "Cupom", aliases: ["cupom", "desconto"] },
  { key: "comissao_afiliado", label: "Comissão Afiliado", aliases: ["comissao afiliado", "comissão afiliado", "afiliado"] },
  { key: "frete_entrega_direta", label: "Frete Entrega Direta", aliases: ["frete entrega direta", "entrega direta"] },
  { key: "cancelamentos", label: "Cancelamentos/Devoluções", aliases: ["cancelamentos", "devolucoes", "devoluções", "cancelamentos/devoluções"] },
] as const;

export type CampoKey = (typeof CAMPOS)[number]["key"];
export type Mapeamento = Partial<Record<CampoKey, string>>;

const normal = (s: string) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export type Planilha = { colunas: string[]; linhas: Record<string, unknown>[] };

export async function lerArquivo(file: File): Promise<Planilha> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const colunas = Object.keys(linhas[0] ?? {});
  return { colunas, linhas };
}

export function autoMapear(colunas: string[]): Mapeamento {
  const map: Mapeamento = {};
  for (const campo of CAMPOS) {
    const hit = colunas.find((c) =>
      (campo.aliases as readonly string[]).includes(normal(c)),
    );
    if (hit) map[campo.key] = hit;
  }
  return map;
}

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const toNumberOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  return toNumber(v);
};

/** Aceita "2026-01", "01/2026", "Jan/26", data Excel. Retorna "YYYY-MM". */
export function normalizarMes(v: unknown): string | null {
  if (v instanceof Date)
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[2]}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}`;
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  m = normal(s).match(/^([a-z]{3})[a-z]*[/ -](\d{2,4})$/);
  if (m) {
    const idx = meses.indexOf(m[1]!);
    if (idx >= 0) {
      const ano = m[2]!.length === 2 ? `20${m[2]}` : m[2];
      return `${ano}-${String(idx + 1).padStart(2, "0")}`;
    }
  }
  return null;
}

export function converter(
  planilha: Planilha,
  map: Mapeamento,
): { linhas: LinhaImportada[]; erros: string[]; semCusto: number } {
  const erros: string[] = [];
  const out: LinhaImportada[] = [];
  let semCusto = 0;
  const get = (row: Record<string, unknown>, k: CampoKey) =>
    map[k] ? row[map[k]!] : null;

  planilha.linhas.forEach((row, i) => {
    const mes = normalizarMes(get(row, "mes"));
    const sku = String(get(row, "sku") ?? "").trim();
    if (!mes) {
      erros.push(`Linha ${i + 2}: mês inválido ou vazio — linha ignorada.`);
      return;
    }
    if (!sku) {
      erros.push(`Linha ${i + 2}: SKU vazio — linha ignorada.`);
      return;
    }
    const custo = toNumberOrNull(get(row, "custo"));
    if (custo === null) semCusto++;
    out.push({
      mes,
      empresa: String(get(row, "empresa") ?? "").trim() || "Empresa única",
      marketplace: String(get(row, "marketplace") ?? "").trim() || "N/D",
      sku,
      nome_produto: String(get(row, "nome_produto") ?? "").trim() || sku,
      fornecedor: String(get(row, "fornecedor") ?? "").trim() || null,
      unidades: toNumber(get(row, "unidades")),
      receita: toNumber(get(row, "receita")),
      custo,
      // Planilhas de marketplace trazem taxas/deduções como negativas;
      // no DRE elas são grandezas de despesa (positivas).
      tarifa_venda: Math.abs(toNumber(get(row, "tarifa_venda"))),
      tarifa_envio: Math.abs(toNumber(get(row, "tarifa_envio"))),
      receita_envio: Math.abs(toNumber(get(row, "receita_envio"))),
      cupom: Math.abs(toNumber(get(row, "cupom"))),
      comissao_afiliado: Math.abs(toNumber(get(row, "comissao_afiliado"))),
      frete_entrega_direta: Math.abs(toNumber(get(row, "frete_entrega_direta"))),
      cancelamentos: Math.abs(toNumber(get(row, "cancelamentos"))),
    });

  });
  return { linhas: out, erros, semCusto };
}

export function baixarModelo() {
  const header = CAMPOS.map((c) => c.label);
  const exemplo = [
    "2026-01", "GOLDSHOPP", "Mercado Livre", "SKU-001", "Fone Bluetooth XZ",
    "Fornecedor A", 120, 24000, 9600, 3200, 1400, 900, 300, 150, 200, 500,
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, exemplo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendas");
  XLSX.writeFile(wb, "modelo-vendas-dre.xlsx");
}

/* -------------------- Planilha de despesas fixas -------------------- */

export type DespesaImportada = { nome: string; valor: number };

const ALIAS_DESPESA = ["despesa", "descricao", "descrição", "nome", "item", "conta"];
const ALIAS_VALOR = ["valor", "vlr", "total", "montante"];

/** Lê uma planilha com colunas DESPESA e VALOR. */
export async function lerDespesasFixas(file: File): Promise<DespesaImportada[]> {
  const { colunas, linhas } = await lerArquivo(file);
  const acha = (aliases: string[]) =>
    colunas.find((c) => aliases.includes(normal(c))) ??
    colunas.find((c) => aliases.some((a) => normal(c).includes(a)));
  const cNome = acha(ALIAS_DESPESA);
  const cValor = acha(ALIAS_VALOR);
  if (!cNome || !cValor)
    throw new Error("A planilha precisa ter as colunas DESPESA e VALOR.");
  return linhas
    .map((l) => ({
      nome: String(l[cNome] ?? "").trim(),
      valor: Math.abs(toNumber(l[cValor])),
    }))
    .filter((d) => d.nome);
}

/** Baixa um modelo de planilha de despesas fixas. */
export function baixarModeloDespesas() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["DESPESA", "VALOR"],
    ["Aluguel", 3500],
    ["Folha de pagamento", 12000],
    ["Software / ERP", 890],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Despesas Fixas");
  XLSX.writeFile(wb, "modelo-despesas-fixas.xlsx");
}

import * as XLSX from "xlsx";
import type { LinhaImportada } from "./data";

export const CAMPOS = [
  { key: "mes", label: "Data da Venda / Mês", obrigatorio: true, aliases: ["data da venda", "data", "mês", "mes", "periodo", "período", "competencia", "competência"] },
  { key: "empresa", label: "Empresa", aliases: ["empresa", "loja", "cnpj"] },
  { key: "marketplace", label: "Marketplace", aliases: ["marketplace", "canal", "canal de venda"] },
  { key: "sku", label: "SKU", obrigatorio: true, aliases: ["sku", "codigo", "código"] },
  { key: "nome_produto", label: "Produto", aliases: ["produto", "nome do produto", "descricao", "descrição"] },
  { key: "fornecedor", label: "Fornecedor", aliases: ["fornecedor"] },
  { key: "unidades", label: "Unidades", aliases: ["unidades", "quantidade", "qtd"] },
  { key: "receita", label: "Receita por Produto", obrigatorio: true, aliases: ["receita por produto", "receita", "faturamento", "valor de venda"] },
  { key: "custo", label: "Custo", aliases: ["custo", "cmv", "custo do produto"] },
  { key: "tarifa_venda", label: "Tarifa de venda e impostos", aliases: ["tarifa de venda e impostos", "tarifa de venda", "comissao", "comissão", "tarifa venda"] },
  { key: "tarifa_envio", label: "Tarifas de Envio", aliases: ["tarifas de envio", "tarifa de envio", "tarifa envio", "frete"] },
  { key: "receita_envio", label: "Receita por envio", aliases: ["receita por envio", "receita envio"] },
  { key: "cupom", label: "Cupom", aliases: ["cupom", "desconto"] },
  { key: "comissao_afiliado", label: "Comissão Afiliado", aliases: ["comissao afiliado", "comissão afiliado", "afiliado"] },
  { key: "frete_entrega_direta", label: "Frete Entrega Direta", aliases: ["frete entrega direta", "entrega direta"] },
  { key: "cancelamentos", label: "Cancelamentos e Reembolsos", aliases: ["cancelamentos e reembolsos", "cancelamentos", "devolucoes", "devoluções", "cancelamentos/devoluções", "reembolsos"] },
  { key: "estado", label: "Estado (UF)", aliases: ["estado", "uf"] },
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

/** Cabeçalho oficial do modelo (aba "Vendas Reorganizado"). */
export const HEADER_MODELO = [
  "Empresa",
  "Data da Venda",
  "Marketplace",
  "Unidades",
  "Receita por Produto",
  "Custo",
  "Tarifa de venda e impostos",
  "Receita por envio",
  "Tarifas de Envio",
  "Cupom",
  "Comissão Afiliado",
  "Frete Entrega Direta",
  "Total",
  "SKU",
  "Estado",
  "Cancelamentos e Reembolsos",
  "Produto",
  "Fornecedor",
] as const;

const INSTRUCOES: string[] = [
  "MODELO DE PREENCHIMENTO — VENDAS (MARKETPLACES) — MULTI-EMPRESA",
  "",
  "Preencha uma linha por venda na aba 'Vendas Reorganizado', com as colunas abaixo.",
  "A coluna 'Total' é calculada automaticamente (não preencher).",
  "",
  "Empresa — nome da empresa/loja do grupo à qual esta venda pertence. Obrigatório em toda linha: é o que permite separar \"Consolidado\" de cada empresa nas abas DRE Gerencial, DRE Detalhado, Análise Gerencial, Análise por Produto e Simuladores.",
  "Data da Venda — data da venda conforme exportado pelo marketplace (o mês/competência é derivado dela). Aceita também \"2026-01\" ou \"01/2026\".",
  "Marketplace — canal de venda (Mercado Livre, Shopee, Amazon, Site próprio...).",
  "Unidades — quantidade de unidades vendidas na linha.",
  "Receita por Produto — valor bruto recebido pelo produto (positivo).",
  "Custo — custo do produto vendido (positivo). Se ficar vazio, o produto aparece como \"Custo não cadastrado\" e a importação não é bloqueada.",
  "Tarifa de venda e impostos — tarifas/comissão do marketplace (normalmente negativo).",
  "Receita por envio — valor recebido do comprador pelo frete (positivo, ou zero).",
  "Tarifas de Envio — custo do frete pago à transportadora (normalmente negativo).",
  "Cupom — desconto de cupom aplicado na venda pelo marketplace (normalmente negativo, ou zero).",
  "Comissão Afiliado — comissão de afiliado, ajustes e rebates referentes à venda.",
  "Frete Entrega Direta — custo de frete em modalidades de entrega direta, quando informado separadamente.",
  "Total — Receita por Produto + Tarifa de venda e impostos + Receita por envio + Tarifas de Envio + Cupom + Comissão Afiliado + Frete Entrega Direta + Cancelamentos e Reembolsos (fórmula).",
  "SKU — código do produto, usado nas análises por produto.",
  "Estado — UF de entrega do comprador (opcional).",
  "Cancelamentos e Reembolsos — valor estornado ao comprador (normalmente negativo, ou zero).",
  "Produto — nome/descrição do produto, exibido na Análise por Produto.",
  "Fornecedor — fornecedor do produto, usado como filtro na Análise por Produto.",
  "",
  "Valores negativos de tarifas, cupons, fretes e cancelamentos são tratados automaticamente como despesa na DRE.",
  "Importar um novo arquivo atualiza somente os meses presentes nele; os demais meses já salvos permanecem intactos.",
];

export function baixarModelo() {
  const exemplo = [
    ["GOLDSHOPP", "05/01/2026", "Mercado Livre", 2, 480, -190, -68, 25, -32, -12, -5, 0, null, "SKU-001", "SP", 0, "Fone Bluetooth XZ", "Fornecedor A"],
    ["STARSHOPP", "18/01/2026", "Shopee", 1, 150, -60, -21, 0, -14, -8, -3, -6, null, "SKU-002", "MG", 0, "Caixa de Som Mini", "Fornecedor B"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([[...HEADER_MODELO], ...exemplo]);
  // Coluna "Total" (M) como fórmula.
  exemplo.forEach((_, i) => {
    const r = i + 2;
    ws[`M${r}`] = { t: "n", f: `E${r}+G${r}+H${r}+I${r}+J${r}+K${r}+L${r}+P${r}` };
  });
  ws["!cols"] = HEADER_MODELO.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wsInstr = XLSX.utils.aoa_to_sheet(INSTRUCOES.map((l) => [l]));
  wsInstr["!cols"] = [{ wch: 140 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendas Reorganizado");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");
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

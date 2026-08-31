/** Evita exibir "-0,00" quando o valor arredondado é zero. */
const zeroSafe = (v: number, digits: number) => {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
};

export const brl = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(zeroSafe(v, 2));

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(zeroSafe(v, digits)) + "%";

export const num = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "N/D"
    : new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(zeroSafe(v, digits));

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** "2026-01" -> "Jan/26" */
export const mesLabel = (mes: string) => {
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return mes;
  return `${MESES[idx]}/${y.slice(2)}`;
};

export const mesLongo = (mes: string) => {
  const [y, m] = mes.split("-");
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return mes;
  return `${MESES[idx]}/${y}`;
};

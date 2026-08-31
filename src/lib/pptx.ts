import { DreModel, TOTAL, buildDre } from "./dre";
import { brl, pct } from "./format";

const AZUL = "0D1B3E";
const AZUL_CLARO = "29ABE2";
const BRANCO = "FFFFFF";
const CINZA = "444444";

/** Gera e baixa o .pptx da apresentação de resultados. */
export async function exportarApresentacao(
  model: DreModel,
  periodo: string,
  competencia: string,
) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const cliente = model.data.cliente.nome;
  const m = model.metrics(periodo);

  // ---------- Capa (azul) ----------
  const capa = pptx.addSlide();
  capa.background = { color: AZUL };
  capa.addText("DIAGNÓSTICO EMPRESARIAL", {
    x: 0.7,
    y: 1.6,
    w: 8.6,
    h: 0.9,
    fontSize: 34,
    bold: true,
    color: BRANCO,
  });
  capa.addText(`${cliente.toUpperCase()}, ${competencia.toUpperCase()}`, {
    x: 0.7,
    y: 2.5,
    w: 8.6,
    h: 0.8,
    fontSize: 24,
    color: AZUL_CLARO,
    bold: true,
  });
  capa.addShape(pptx.ShapeType.rect, {
    x: 0.7,
    y: 3.5,
    w: 2.2,
    h: 0.06,
    fill: { color: AZUL_CLARO },
  });
  capa.addText("Preparado por Ecommtabil", {
    x: 0.7,
    y: 4.6,
    w: 8.6,
    h: 0.4,
    fontSize: 12,
    color: BRANCO,
  });

  const titulo = (slide: ReturnType<typeof pptx.addSlide>, texto: string, kicker: string) => {
    slide.addText(kicker.toUpperCase(), {
      x: 0.6,
      y: 0.35,
      w: 8.8,
      h: 0.3,
      fontSize: 11,
      bold: true,
      color: AZUL_CLARO,
      charSpacing: 1,
    });
    slide.addText(texto, {
      x: 0.6,
      y: 0.65,
      w: 8.8,
      h: 0.55,
      fontSize: 24,
      bold: true,
      color: AZUL,
    });
  };

  // ---------- Resultado do período ----------
  const s2 = pptx.addSlide();
  titulo(s2, "Como o negócio performou", "Resultado do período");
  const stats: [string, string, string][] = [
    ["Faturamento", brl(m.faturamento), `${m.unidades} unidades vendidas`],
    [
      "Margem de Contribuição",
      brl(m.margemContribuicao),
      `${pct(m.margemContribuicaoPct)} do faturamento`,
    ],
    ["Lucro Líquido", brl(m.lucroLiquido), `Margem líquida ${pct(m.margemLiquidaPct)}`],
  ];
  stats.forEach(([label, valor, nota], i) => {
    const x = 0.6 + i * 2.98;
    s2.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.6,
      w: 2.75,
      h: 1.8,
      fill: { color: "F2F5FA" },
      line: { color: "DDE3EE" },
      rectRadius: 0.08,
    });
    s2.addText(label, { x: x + 0.2, y: 1.75, w: 2.4, h: 0.3, fontSize: 12, color: CINZA });
    s2.addText(valor, {
      x: x + 0.2,
      y: 2.1,
      w: 2.4,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: AZUL,
    });
    s2.addText(nota, { x: x + 0.2, y: 2.8, w: 2.4, h: 0.4, fontSize: 10, color: CINZA });
  });
  s2.addText(
    `Ponto de equilíbrio do período: ${brl(m.pontoEquilibrio)} de faturamento — abaixo disso a operação opera no prejuízo.`,
    { x: 0.6, y: 3.8, w: 8.8, h: 0.5, fontSize: 12, color: CINZA },
  );

  // ---------- DRE resumida ----------
  const s3 = pptx.addSlide();
  titulo(s3, "Da venda ao lucro", "DRE Gerencial resumida");
  const dre = buildDre(model, { detalhe: "nenhum", completo: true }).filter(
    (l) => l.kind === "synth",
  );
  const dreRows = [
    [
      { text: "Linha", options: { bold: true, color: BRANCO, fill: { color: AZUL } } },
      { text: "Valor", options: { bold: true, color: BRANCO, fill: { color: AZUL }, align: "right" as const } },
      { text: "AV %", options: { bold: true, color: BRANCO, fill: { color: AZUL }, align: "right" as const } },
    ],
    ...dre.map((l) => {
      const v = l.values[periodo];
      return [
        { text: l.label },
        { text: v === null || v === undefined ? "N/D" : brl(v), options: { align: "right" as const } },
        {
          text: m.faturamento ? pct(((v ?? 0) / m.faturamento) * 100) : "—",
          options: { align: "right" as const },
        },
      ];
    }),
  ];
  s3.addTable(dreRows, {
    x: 0.6,
    y: 1.35,
    w: 8.8,
    fontSize: 10,
    border: { type: "solid", color: "E3E8F0", pt: 0.5 },
    colW: [4.8, 2, 2],
  });

  // ---------- Marketplaces ----------
  const s4 = pptx.addSlide();
  titulo(s4, "Desempenho por marketplace", "Canais de venda");
  const porMk = model.marketplaces
    .map((mk) => ({ nome: mk, mm: model.metrics(periodo, { marketplace: mk }, false) }))
    .sort((a, b) => b.mm.faturamento - a.mm.faturamento);
  s4.addTable(
    [
      ["Marketplace", "Faturamento", "Participação", "Margem de Contrib.", "MC %"].map((t) => ({
        text: t,
        options: { bold: true, color: BRANCO, fill: { color: AZUL } },
      })),
      ...porMk.map((r) => [
        { text: r.nome },
        { text: brl(r.mm.faturamento), options: { align: "right" as const } },
        {
          text: pct(m.faturamento ? (r.mm.faturamento / m.faturamento) * 100 : null),
          options: { align: "right" as const },
        },
        { text: brl(r.mm.margemContribuicao), options: { align: "right" as const } },
        { text: pct(r.mm.margemContribuicaoPct), options: { align: "right" as const } },
      ]),
    ],
    { x: 0.6, y: 1.35, w: 8.8, fontSize: 10, border: { type: "solid", color: "E3E8F0", pt: 0.5 } },
  );
  s4.addText(
    "Imposto e despesas fixas não são rastreados por canal, então a cascata por marketplace vai até a Margem de Contribuição.",
    { x: 0.6, y: 4.6, w: 8.8, h: 0.4, fontSize: 9, color: CINZA },
  );

  // ---------- Produtos ----------
  const map = new Map<string, { sku: string; nome: string; margem: number }>();
  for (const v of model.vendasDoPeriodo(periodo)) {
    const despVar =
      v.tarifa_venda +
      v.tarifa_envio -
      v.receita_envio +
      v.cupom +
      v.comissao_afiliado +
      v.frete_entrega_direta;
    const margem = v.receita - (v.custo ?? 0) - despVar;
    const atual = map.get(v.sku);
    if (atual) atual.margem += margem;
    else map.set(v.sku, { sku: v.sku, nome: v.nome_produto, margem });
  }
  const arr = Array.from(map.values());
  const melhores = [...arr].sort((a, b) => b.margem - a.margem).slice(0, 5);
  const piores = [...arr].sort((a, b) => a.margem - b.margem).slice(0, 5);

  const s5 = pptx.addSlide();
  titulo(s5, "Onde está a margem", "Produtos");
  const bloco = (
    x: number,
    head: string,
    itens: { sku: string; nome: string; margem: number }[],
  ) => {
    s5.addText(head, { x, y: 1.35, w: 4.2, h: 0.35, fontSize: 14, bold: true, color: AZUL });
    s5.addTable(
      itens.map((p) => [
        { text: p.nome || p.sku },
        {
          text: brl(p.margem),
          options: { align: "right" as const, color: p.margem >= 0 ? "1B7F42" : "B3261E" },
        },
      ]),
      { x, y: 1.8, w: 4.2, fontSize: 10, border: { type: "solid", color: "E3E8F0", pt: 0.5 } },
    );
  };
  bloco(0.6, "Maiores margens", melhores);
  bloco(5.2, "Atenção imediata", piores);

  // ---------- Participação por marketplace ----------
  const taxasMk = new Map<string, { fat: number; taxas: number }>();
  for (const v of model.vendasDoPeriodo(periodo)) {
    const t =
      v.tarifa_venda +
      v.tarifa_envio -
      v.receita_envio +
      v.cupom +
      v.comissao_afiliado +
      v.frete_entrega_direta;
    const a = taxasMk.get(v.marketplace) ?? { fat: 0, taxas: 0 };
    a.fat += v.receita;
    a.taxas += t;
    taxasMk.set(v.marketplace, a);
  }
  const partes = Array.from(taxasMk.entries())
    .map(([nome, a]) => ({ nome, ...a }))
    .sort((x, y) => y.fat - x.fat);
  const totalFat = partes.reduce((a, b) => a + b.fat, 0);
  const totalTaxas = partes.reduce((a, b) => a + b.taxas, 0);

  const sPart = pptx.addSlide();
  titulo(sPart, "Participação no faturamento", "Mix de canais");
  if (partes.length) {
    sPart.addChart(
      pptx.ChartType.pie,
      [
        {
          name: "Faturamento",
          labels: partes.map((p) => p.nome),
          values: partes.map((p) => p.fat),
        },
      ],
      {
        x: 0.6,
        y: 1.35,
        w: 4.2,
        h: 3.4,
        showPercent: true,
        showLegend: true,
        legendPos: "b",
        dataLabelColor: BRANCO,
      },
    );
  }
  sPart.addTable(
    [
      ["Marketplace", "Faturamento", "Part. %"].map((t) => ({
        text: t,
        options: { bold: true, color: BRANCO, fill: { color: AZUL } },
      })),
      ...partes.map((p) => [
        { text: p.nome },
        { text: brl(p.fat), options: { align: "right" as const } },
        {
          text: pct(totalFat ? (p.fat / totalFat) * 100 : null),
          options: { align: "right" as const },
        },
      ]),
    ],
    { x: 5.2, y: 1.35, w: 4.2, fontSize: 10, border: { type: "solid", color: "E3E8F0", pt: 0.5 } },
  );

  // ---------- Participação de taxas por marketplace ----------
  const taxasOrd = [...partes].sort((a, b) => b.taxas - a.taxas);
  const sTaxas = pptx.addSlide();
  titulo(sTaxas, "Participação de taxas por marketplace", "Custo dos canais");
  if (taxasOrd.length) {
    sTaxas.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Taxas",
          labels: taxasOrd.map((p) => p.nome),
          values: taxasOrd.map((p) => p.taxas),
        },
      ],
      {
        x: 0.6,
        y: 1.35,
        w: 4.2,
        h: 3.4,
        barDir: "bar",
        chartColors: [AZUL_CLARO],
        showLegend: false,
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
      },
    );
  }
  sTaxas.addTable(
    [
      ["Marketplace", "Taxas", "% das taxas", "% do fat. do canal"].map((t) => ({
        text: t,
        options: { bold: true, color: BRANCO, fill: { color: AZUL } },
      })),
      ...taxasOrd.map((p) => [
        { text: p.nome },
        { text: brl(p.taxas), options: { align: "right" as const } },
        {
          text: pct(totalTaxas ? (p.taxas / totalTaxas) * 100 : null),
          options: { align: "right" as const },
        },
        {
          text: pct(p.fat ? (p.taxas / p.fat) * 100 : null),
          options: { align: "right" as const },
        },
      ]),
    ],
    { x: 5.2, y: 1.35, w: 4.2, fontSize: 10, border: { type: "solid", color: "E3E8F0", pt: 0.5 } },
  );

  // ---------- Plano de ação ----------
  const s6 = pptx.addSlide();
  s6.background = { color: AZUL };
  s6.addText("PRÓXIMOS PASSOS", {
    x: 0.7,
    y: 0.8,
    w: 8.6,
    h: 0.3,
    fontSize: 11,
    bold: true,
    color: AZUL_CLARO,
  });
  s6.addText("Plano de ação", {
    x: 0.7,
    y: 1.1,
    w: 8.6,
    h: 0.6,
    fontSize: 26,
    bold: true,
    color: BRANCO,
  });
  s6.addText(
    [
      "Revisar preço e custo dos SKUs com margem negativa.",
      "Concentrar investimento nos canais com melhor margem de contribuição.",
      `Manter faturamento acima do ponto de equilíbrio de ${brl(m.pontoEquilibrio)}.`,
      "Cadastrar custos faltantes para fechar a análise por produto.",
    ].map((t) => ({ text: t, options: { bullet: true, color: BRANCO, fontSize: 14 } })),
    { x: 0.9, y: 2, w: 8.2, h: 2, lineSpacingMultiple: 1.4 },
  );
  s6.addText("Preparado por Ecommtabil", {
    x: 0.7,
    y: 4.7,
    w: 8.6,
    h: 0.3,
    fontSize: 11,
    color: BRANCO,
  });

  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  await pptx.writeFile({
    fileName: `Diagnostico-Empresarial-${slug(cliente)}-${slug(competencia)}.pptx`,
  });
  return periodo === TOTAL;
}

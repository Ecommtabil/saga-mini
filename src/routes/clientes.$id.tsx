import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchDataset } from "@/lib/data";
import { DreModel, TOTAL, buildDre } from "@/lib/dre";
import { mesLabel } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { DreWideTable } from "@/components/DreWideTable";
import { KpiCards } from "@/components/KpiCards";
import { DreDetalhado } from "@/components/DreDetalhado";
import { AnaliseGerencial } from "@/components/AnaliseGerencial";
import { AnaliseProduto } from "@/components/AnaliseProduto";
import { Simuladores } from "@/components/Simuladores";
import { ImportModal } from "@/components/ImportModal";
import { ParametrosModal } from "@/components/ParametrosModal";
import { ApresentacaoModal } from "@/components/ApresentacaoModal";

export const Route = createFileRoute("/clientes/$id")({
  head: () => ({
    meta: [
      { title: "DRE Gerencial do cliente — Diagnóstico Empresarial" },
      {
        name: "description",
        content:
          "DRE Gerencial completa por empresa e marketplace, com margem de contribuição, ponto de equilíbrio, análise por SKU e simulador de cenários.",
      },
      { property: "og:title", content: "DRE Gerencial do cliente" },
      {
        property: "og:description",
        content: "Análise gerencial por empresa, marketplace e produto.",
      },
    ],
  }),
  component: ClientePage,
});

type Aba = "dre" | "detalhado" | "gerencial" | "produto" | "simulador";

function ClientePage() {
  const { id } = Route.useParams();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("dre");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<string>(TOTAL);
  const [importar, setImportar] = useState(false);
  const [parametros, setParametros] = useState(false);
  const [apresentar, setApresentar] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => fetchDataset(id),
    enabled: !!session,
  });

  const model = useMemo(() => (data ? new DreModel(data) : null), [data]);

  useEffect(() => {
    if (model && !model.periodos().includes(periodo)) setPeriodo(TOTAL);
  }, [model, periodo]);

  if (loading || !session) return null;
  if (isLoading || !model) {
    return (
      <div className="diag-container">
        <p className="table-note">Carregando dados do cliente…</p>
      </div>
    );
  }

  const multiEmpresa = model.data.empresas.length >= 2;
  const semDados = model.data.vendas.length === 0;

  const linhasGerenciais = buildDre(model, {
    detalhe: multiEmpresa ? "empresa" : "nenhum",
    completo: true,
  });

  const abas: [Aba, string][] = [
    ["dre", "DRE Gerencial"],
    ...(multiEmpresa ? ([["detalhado", "DRE Detalhado"]] as [Aba, string][]) : []),
    ["gerencial", "Análise Gerencial"],
    ["produto", "Análise por Produto"],
    ["simulador", "Simulador de Cenários"],
  ];

  return (
    <div>
      <header className="diag-header">
        <div className="header-actions no-print">
          <Link to="/" className="btn ghost">
            ← Clientes
          </Link>
          <button className="btn" onClick={() => setParametros(true)}>
            Parâmetros
          </button>
          <button className="btn primary" onClick={() => setImportar(true)}>
            Importar planilha
          </button>
          <button className="btn" onClick={() => setApresentar(true)}>
            Apresentação
          </button>
          <Link to="/clientes/$id/apresentacao" params={{ id }} className="btn ghost">
            Ver slides
          </Link>
        </div>
        <h1>{model.data.cliente.nome}</h1>
        <p>
          DRE Gerencial —{" "}
          {model.meses.length
            ? `${mesLabel(model.meses[0]!)} a ${mesLabel(model.meses[model.meses.length - 1]!)}`
            : "sem períodos importados"}
        </p>
        <span className="diag-badge">Preparado por Ecommtabil</span>
      </header>

      <div className="diag-container wide">
        <nav className="tabs no-print">
          {abas.map(([k, label]) => (
            <button key={k} className={aba === k ? "active" : ""} onClick={() => setAba(k)}>
              {label}
            </button>
          ))}
        </nav>

        {semDados ? (
          <section className="panel">
            <p className="empty-state">
              Nenhuma venda importada ainda. Use <strong>Importar planilha</strong>{" "}
              para carregar as vendas por produto (com empresa e marketplace em
              cada linha).
            </p>
          </section>
        ) : (
          <>
            {(aba === "produto" || aba === "detalhado" || aba === "dre") && (
              <div className="toolbar no-print">
                <span className="toolbar-label">
                  {aba === "dre" ? "KPIs do mês:" : "Período:"}
                </span>
                {model.periodos().map((p) => (
                  <button
                    key={p}
                    className={periodo === p ? "active" : ""}
                    onClick={() => setPeriodo(p)}
                  >
                    {p === TOTAL ? "Período Total" : mesLabel(p)}
                  </button>
                ))}
              </div>
            )}

            {aba === "dre" && (
              <>
                <KpiCards model={model} periodo={periodo} />
            <section className="panel bleed">
                  <h2>DRE Gerencial {multiEmpresa ? "— consolidado por empresa" : ""}</h2>
                  <DreWideTable
                    model={model}
                    lines={linhasGerenciais}
                    nota="Granularidade por Empresa. O cruzamento empresa × marketplace fica na aba DRE Detalhado. Clique nas linhas síntese para abrir os detalhes."
                  />
                </section>
              </>
            )}

            {aba === "detalhado" && multiEmpresa && (
              <DreDetalhado
                model={model}
                periodo={periodo}
                empresaId={empresaId}
                onEmpresa={setEmpresaId}
              />
            )}

            {aba === "gerencial" && <AnaliseGerencial model={model} />}
            {aba === "produto" && <AnaliseProduto model={model} periodo={periodo} />}
            {aba === "simulador" && <Simuladores model={model} />}
          </>
        )}
      </div>

      {importar && (
        <ImportModal
          clienteId={id}
          onClose={() => setImportar(false)}
          onImportado={() => {
            setImportar(false);
            void refetch();
          }}
        />
      )}
      {apresentar && (
        <ApresentacaoModal model={model} onClose={() => setApresentar(false)} />
      )}
      {parametros && (
        <ParametrosModal
          model={model}
          mesInicial={periodo === TOTAL ? (model.meses[model.meses.length - 1] ?? "") : periodo}
          onClose={() => setParametros(false)}
          onSalvo={async () => {
            setParametros(false);
            await refetch();
          }}
        />
      )}
    </div>
  );
}

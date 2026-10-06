import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createCliente, deleteCliente, listClientes } from "@/lib/data";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Diagnóstico Empresarial — DRE Gerencial para Marketplaces" },
      {
        name: "description",
        content:
          "Monte a DRE Gerencial de clientes que vendem em marketplaces: margem de contribuição, ponto de equilíbrio, análise por SKU e apresentação pronta.",
      },
      { property: "og:title", content: "Diagnóstico Empresarial — DRE Gerencial" },
      {
        property: "og:description",
        content:
          "DRE Gerencial multi-empresa e multi-marketplace para escritórios de contabilidade e e-commerce.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [aliquota, setAliquota] = useState("8");
  const [clienteParaExcluir, setClienteParaExcluir] = useState<{ id: string; nome: string } | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: listClientes,
    enabled: !!session,
  });

  const abrirConfirmacao = (id: string, nomeCliente: string) => {
    setClienteParaExcluir({ id, nome: nomeCliente });
    setConfirmacao("");
  };

  const fecharConfirmacao = () => {
    setClienteParaExcluir(null);
    setConfirmacao("");
    setExcluindo(false);
  };

  const executarExclusao = async () => {
    if (!clienteParaExcluir) return;
    if (confirmacao.trim() !== clienteParaExcluir.nome.trim()) {
      toast.error("Digite o nome exato do cliente para confirmar.");
      return;
    }
    setExcluindo(true);
    try {
      await deleteCliente(clienteParaExcluir.id);
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente excluído.");
      fecharConfirmacao();
    } catch {
      toast.error("Não foi possível excluir.");
    } finally {
      setExcluindo(false);
    }
  };


  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    try {
      const c = await createCliente(nome.trim(), Number(aliquota) || 0);
      setNome("");
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      void navigate({ to: "/clientes/$id", params: { id: c.id } });
    } catch {
      toast.error("Não foi possível criar o cliente.");
    }
  };


  if (loading || !session) return null;

  return (
    <div>
      <header className="diag-header">
        <div className="header-actions no-print">
          <button className="btn ghost" onClick={() => void supabase.auth.signOut()}>
            Sair
          </button>
        </div>
        <h1>Diagnóstico Empresarial</h1>
        <p>DRE Gerencial multi-empresa e multi-marketplace</p>
        <span className="diag-badge">{session.user.email}</span>
      </header>

      <div className="diag-container">
        <section className="panel">
          <h2>Clientes</h2>
          {isLoading ? (
            <p className="table-note">Carregando…</p>
          ) : !clientes?.length ? (
            <p className="empty-state">
              Nenhum cliente cadastrado. Crie o primeiro abaixo e importe a
              planilha de vendas do mês.
            </p>
          ) : (
            <div className="client-grid">
              {clientes.map((c) => (
                <div className="client-card" key={c.id}>
                  <Link to="/clientes/$id" params={{ id: c.id }} className="client-card-link">
                    <strong>{c.nome}</strong>
                    <span>Alíquota padrão {c.aliquota_simples_padrao}%</span>
                  </Link>
                  <button
                    className="btn danger sm client-delete-btn"
                    onClick={() => abrirConfirmacao(c.id, c.nome)}
                    title={`Excluir ${c.nome}`}
                  >
                    🗑 Excluir
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Novo cliente</h2>
          <form onSubmit={criar} className="filters" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Nome do cliente</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Grupo Alfa" />
            </div>
            <div className="field">
              <label>Alíquota Simples padrão (%)</label>
              <input
                type="number"
                step="0.01"
                value={aliquota}
                onChange={(e) => setAliquota(e.target.value)}
              />
            </div>
            <button className="btn primary" type="submit">
              Criar cliente
            </button>
          </form>
        </section>
      </div>

      <AlertDialog open={!!clienteParaExcluir} onOpenChange={(open) => !open && fecharConfirmacao()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              A exclusão de <strong>{clienteParaExcluir?.nome}</strong> remove permanentemente todos os dados importados (vendas, despesas e parâmetros). Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Digite o nome do cliente para confirmar
            </label>
            <input
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={clienteParaExcluir?.nome}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void executarExclusao();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={fecharConfirmacao} disabled={excluindo}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => void executarExclusao()}
                disabled={excluindo || confirmacao.trim() !== clienteParaExcluir?.nome.trim()}
              >
                {excluindo ? "Excluindo…" : "Sim, excluir cliente"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Diagnóstico Empresarial Ecommtabil" },
      {
        name: "description",
        content:
          "Acesse o painel de DRE Gerencial multi-empresa e multi-marketplace da Ecommtabil.",
      },
      { property: "og:title", content: "Entrar — Diagnóstico Empresarial" },
      {
        property: "og:description",
        content: "DRE Gerencial para e-commerce em marketplaces.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        void navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se a confirmação estiver ativa.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setEnviando(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com Google.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <div>
      <header className="diag-header">
        <h1>Diagnóstico Empresarial — DRE Gerencial</h1>
        <p>Multi-empresa e multi-marketplace para escritórios de contabilidade</p>
        <span className="diag-badge">Preparado por Ecommtabil</span>
      </header>
      <div className="diag-container" style={{ maxWidth: 460, marginTop: 40 }}>
        <section className="panel">
          <h2>{modo === "login" ? "Entrar" : "Criar conta"}</h2>
          <form onSubmit={submit}>
            <div className="field" style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, color: "var(--muted-ink)", fontWeight: 600 }}>E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)" }}
              />
            </div>
            <div className="field" style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 18 }}>
              <label style={{ fontSize: 11.5, color: "var(--muted-ink)", fontWeight: 600 }}>Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)" }}
              />
            </div>
            <button className="btn primary" type="submit" disabled={enviando} style={{ width: "100%" }}>
              {enviando ? "Aguarde…" : modo === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={() => void google()}>
            Entrar com Google
          </button>
          <p className="table-note" style={{ textAlign: "center" }}>
            {modo === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              className="sim-reset-link"
              style={{ background: "none", border: "none", color: "var(--blue-med)", fontWeight: 600, cursor: "pointer" }}
              onClick={() => setModo(modo === "login" ? "signup" : "login")}
            >
              {modo === "login" ? "Criar agora" : "Entrar"}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";
import type {
  Cliente,
  Dataset,
  DespesaFixa,
  Empresa,
  ParametroMensal,
  Venda,
} from "./types";

export async function listClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, aliquota_simples_padrao")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function createCliente(nome: string, aliquota: number) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sessão expirada");
  const { data, error } = await supabase
    .from("clientes")
    .insert({ nome, aliquota_simples_padrao: aliquota, user_id: uid })
    .select("id, nome, aliquota_simples_padrao")
    .single();
  if (error) throw error;
  return data as Cliente;
}

export async function deleteCliente(id: string) {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

/** Busca todas as vendas do cliente em páginas (a API limita ~1000 linhas por request). */
async function fetchVendas(clienteId: string) {
  const PAGE = 1000;
  const todas: unknown[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await supabase
      .from("vendas_produto")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: true })
      .range(de, de + PAGE - 1);
    if (error) throw error;
    todas.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return todas;
}

export async function fetchDataset(clienteId: string): Promise<Dataset> {
  const [cli, emp, ven, fix, par] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, aliquota_simples_padrao")
      .eq("id", clienteId)
      .single(),
    supabase
      .from("empresas")
      .select("id, cliente_id, nome")
      .eq("cliente_id", clienteId)
      .order("nome"),
    fetchVendas(clienteId),
    supabase.from("despesas_fixas").select("*").eq("cliente_id", clienteId),
    supabase.from("parametros_mensais").select("*").eq("cliente_id", clienteId),
  ]);
  if (cli.error) throw cli.error;
  if (emp.error) throw emp.error;
  if (fix.error) throw fix.error;
  if (par.error) throw par.error;


  const numeric = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    cliente: {
      ...(cli.data as Cliente),
      aliquota_simples_padrao: Number(cli.data.aliquota_simples_padrao),
    },
    empresas: (emp.data ?? []) as Empresa[],
    vendas: ((ven.data ?? []) as Venda[]).map((v) => ({
      ...v,
      unidades: Number(v.unidades),
      receita: Number(v.receita),
      custo: numeric(v.custo),
      tarifa_venda: Number(v.tarifa_venda),
      tarifa_envio: Number(v.tarifa_envio),
      receita_envio: Number(v.receita_envio),
      cupom: Number(v.cupom),
      comissao_afiliado: Number(v.comissao_afiliado),
      frete_entrega_direta: Number(v.frete_entrega_direta),
      cancelamentos: Number(v.cancelamentos),
    })),
    fixas: ((fix.data ?? []) as DespesaFixa[]).map((f) => ({
      ...f,
      valor: Number(f.valor),
    })),
    parametros: ((par.data ?? []) as ParametroMensal[]).map((p) => ({
      ...p,
      aliquota_simples_pct: Number(p.aliquota_simples_pct),
    })),
  };
}

export type LinhaImportada = {
  mes: string;
  empresa: string;
  marketplace: string;
  sku: string;
  nome_produto: string;
  fornecedor: string | null;
  unidades: number;
  receita: number;
  custo: number | null;
  tarifa_venda: number;
  tarifa_envio: number;
  receita_envio: number;
  cupom: number;
  comissao_afiliado: number;
  frete_entrega_direta: number;
  cancelamentos: number;
};

/** Upsert por (empresa, marketplace, mês, sku). Meses ausentes ficam intactos. */
export async function importarLinhas(clienteId: string, linhas: LinhaImportada[]) {
  const nomesEmpresa = Array.from(new Set(linhas.map((l) => l.empresa)));
  const { data: existentes, error: e1 } = await supabase
    .from("empresas")
    .select("id, cliente_id, nome")
    .eq("cliente_id", clienteId);
  if (e1) throw e1;
  const mapa = new Map((existentes ?? []).map((e) => [e.nome, e.id]));

  const faltantes = nomesEmpresa.filter((n) => !mapa.has(n));
  if (faltantes.length) {
    const { data: novas, error: e2 } = await supabase
      .from("empresas")
      .insert(faltantes.map((nome) => ({ cliente_id: clienteId, nome })))
      .select("id, nome");
    if (e2) throw e2;
    for (const n of novas ?? []) mapa.set(n.nome, n.id);
  }

  // Agrupa duplicatas do arquivo na mesma chave para evitar conflito no upsert.
  // A chave é normalizada (caixa/espaços) para que "Chapa" e "CHAPA" sejam o mesmo SKU.
  const norm = (s: string) => s.trim().toLowerCase();
  const agrupado = new Map<string, LinhaImportada>();
  for (const l of linhas) {
    const k = `${norm(l.empresa)}|${norm(l.marketplace)}|${l.mes}|${norm(l.sku)}`;
    const atual = agrupado.get(k);
    if (!atual) {
      agrupado.set(k, { ...l });
      continue;
    }
    atual.unidades += l.unidades;
    atual.receita += l.receita;
    if (l.custo !== null) atual.custo = (atual.custo ?? 0) + l.custo;
    atual.tarifa_venda += l.tarifa_venda;
    atual.tarifa_envio += l.tarifa_envio;
    atual.receita_envio += l.receita_envio;
    atual.cupom += l.cupom;
    atual.comissao_afiliado += l.comissao_afiliado;
    atual.frete_entrega_direta += l.frete_entrega_direta;
    atual.cancelamentos += l.cancelamentos;
  }


  const rows = Array.from(agrupado.values()).map((l) => ({
    cliente_id: clienteId,
    empresa_id: mapa.get(l.empresa)!,
    marketplace: l.marketplace,
    mes: l.mes,
    sku: l.sku,
    nome_produto: l.nome_produto,
    fornecedor: l.fornecedor,
    unidades: l.unidades,
    receita: l.receita,
    custo: l.custo,
    tarifa_venda: l.tarifa_venda,
    tarifa_envio: l.tarifa_envio,
    receita_envio: l.receita_envio,
    cupom: l.cupom,
    comissao_afiliado: l.comissao_afiliado,
    frete_entrega_direta: l.frete_entrega_direta,
    cancelamentos: l.cancelamentos,
  }));

  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase
      .from("vendas_produto")
      .upsert(rows.slice(i, i + 400), {
        onConflict: "cliente_id,empresa_id,marketplace,mes,sku",
      });
    if (error) throw error;
  }
  return {
    lidas: linhas.length,
    linhas: rows.length,
    meses: Array.from(new Set(rows.map((r) => r.mes))),
  };

}

export async function salvarAliquota(clienteId: string, mes: string, pct: number) {
  const { error } = await supabase
    .from("parametros_mensais")
    .upsert(
      { cliente_id: clienteId, mes, aliquota_simples_pct: pct },
      { onConflict: "cliente_id,mes" },
    );
  if (error) throw error;
}

export async function salvarDespesasFixas(
  clienteId: string,
  mes: string,
  empresaId: string | null,
  itens: { nome: string; valor: number }[],
) {
  let del = supabase
    .from("despesas_fixas")
    .delete()
    .eq("cliente_id", clienteId)
    .eq("mes", mes);
  del = empresaId ? del.eq("empresa_id", empresaId) : del.is("empresa_id", null);
  const { error: e1 } = await del;
  if (e1) throw e1;
  const rows = itens
    .filter((i) => i.nome.trim())
    .map((i) => ({
      cliente_id: clienteId,
      mes,
      empresa_id: empresaId,
      nome: i.nome.trim(),
      valor: i.valor,
    }));
  if (!rows.length) return;
  const { error: e2 } = await supabase.from("despesas_fixas").insert(rows);
  if (e2) throw e2;
}

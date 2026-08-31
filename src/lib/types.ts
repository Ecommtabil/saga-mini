export type Cliente = {
  id: string;
  nome: string;
  aliquota_simples_padrao: number;
};

export type Empresa = { id: string; cliente_id: string; nome: string };

export type Venda = {
  id: string;
  cliente_id: string;
  empresa_id: string;
  marketplace: string;
  mes: string;
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

export type DespesaFixa = {
  id: string;
  cliente_id: string;
  empresa_id: string | null;
  mes: string;
  nome: string;
  valor: number;
};

export type ParametroMensal = {
  id: string;
  cliente_id: string;
  mes: string;
  aliquota_simples_pct: number;
};

export type Dataset = {
  cliente: Cliente;
  empresas: Empresa[];
  vendas: Venda[];
  fixas: DespesaFixa[];
  parametros: ParametroMensal[];
};

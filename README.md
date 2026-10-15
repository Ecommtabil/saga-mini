# Saga Mini

Prompt para o Lovable — Diagnóstico Empresarial (DRE Gerencial Multi-empresa e Multi-marketplace)

1. O que é o produto

Construa um dashboard financeiro (SaaS interno) para escritórios de contabilidade/e-commerce que gerencia DRE Gerencial (Demonstrativo de Resultado) de clientes que vendem em marketplaces (Mercado Livre, Shopee, Amazon, TikTok Shop, Magalu etc.), possivelmente com múltiplas empresas/lojas consolidadas num único grupo.

O usuário importa uma planilha de vendas mensal, e o sistema:

Monta um DRE Gerencial completo (Faturamento → Lucro Líquido), mês a mês e período total.

Permite abrir o DRE por Empresa (loja) e por Marketplace (canal de venda).

Calcula margem de contribuição e ponto de equilíbrio.

Compara indicadores dinamicamente (gráfico "tesoura").

Analisa margem por produto individual (SKU).

Simula cenários (e se o custo subir 5%? e se a alíquota do Simples mudar?).

Gera uma apresentação de slides pronta para reunião com o cliente.

Público: contadores e gestores de e-commerce, não é o consumidor final. Interface densa em dados, mas organizada — pense "Looker/Metabase para DRE", não um app consumer.

2. Arquitetura recomendada

Diferente de uma versão anterior deste app (um único arquivo HTML autônomo salvo localmente), quero que este seja um app de verdade com:

Banco de dados persistente (uma tabela de "projetos"/"clientes", cada um com seus meses importados, parâmetros e histórico) — não depender de localStorage nem de reprocessar tudo a cada carregamento.

Multi-tenant simples: cada usuário autenticado vê só os seus projetos/clientes.

Ao importar uma nova planilha, os dados daquele(s) mês(es) são upsertados (atualizam o que já existe, sem apagar os demais meses já importados).

Ao consolidar múltiplas empresas, guarde o detalhamento por Empresa e por Marketplace de forma persistente (não perca essa granularidade depois de salvar — esse foi um bug real da versão anterior: o "cruzamento" empresa × marketplace só existia em memória e sumia ao recarregar).

3. Modelo de dados (conceitual)

```

Cliente (projeto)

  id, nome, aliquota_simples_padrao

Empresa (loja dentro do cliente — pode ter só 1)

  id, cliente_id, nome  (ex: "GOLDSHOPP")

Marketplace

  id, nome (ex: "Mercado Livre", "Shopee")  -- catálogo simples, pode ser texto livre

VendaProduto (linha por SKU, por mês, por empresa, por marketplace)

  id, cliente_id, empresa_id, marketplace, mes (YYYY-MM),

  sku, nome_produto, fornecedor,

  unidades, receita, custo, despesas_variaveis (lump),

  tarifa_venda, tarifa_envio, receita_envio, cupom, comissao_afiliado, frete_entrega_direta,

  cancelamentos

DespesaFixa

  id, cliente_id, empresa_id (nullable = despesa do grupo todo), mes, nome, valor

ParametroMensal

  id, cliente_id, mes, aliquota_simples_pct

```

Cada linha de `VendaProduto` já vem com `empresa_id` + `marketplace` — é a partir dela que TODA a análise por empresa e por marketplace deve ser derivada (agregações SQL/consultas, não duplicação de tabelas). Isso evita o bug de perder a granularidade cruzada.

4. Importação da planilha

Tela para fazer upload de `.xlsx`/`.csv` com uma linha por venda de produto/mês.

Colunas esperadas (nomeáveis/mapeáveis na tela de import, com um botão "baixar modelo"):

`Mês`, `Empresa` (opcional — se ausente, assume empresa única), `Marketplace` (opcional — se ausente, marca como "N/D"), `SKU`, `Produto`, `Fornecedor` (opcional), `Unidades`, `Receita`, `Custo`, `Tarifa de Venda`, `Tarifa de Envio`, `Receita por Envio`, `Cupom`, `Comissão Afiliado`, `Frete Entrega Direta`, `Cancelamentos/Devoluções`.

Validação: linhas sem Custo cadastrado não bloqueiam a importação, mas o produto fica marcado como "Custo não cadastrado" na análise por produto (ver seção 8).

Importar um novo arquivo atualiza só os meses presentes nele; os demais meses já salvos permanecem intactos.

Tela separada (modal "Parâmetros") para:

Alíquota do Simples Nacional por mês (%, editável mês a mês).

Despesas Fixas por mês (lista de nome + valor, pode ter uma lista por empresa quando há múltiplas empresas, mais uma visão consolidada = soma de todas).

5. Barra superior (global, em todas as telas)

Nome do cliente/projeto ativo.

Botão "Parâmetros" (abre o modal da seção 4).

Botão "Exportar" (gera a apresentação de slides — ver seção 10).

Seletor de período: botões por mês (Jan/26, Fev/26...) + botão "Período Total". Este seletor é global: toda tela que mostra números "do mês" deve reagir a ele, mostrando o mês escolhido; ao marcar "Período Total", mostra o acumulado de todos os meses com dados. Isso vale para todo cartão de KPI em qualquer aba — nunca deixar um cartão preso no acumulado enquanto um mês específico está selecionado.

Se o cliente tem 2+ empresas, mostrar aqui também um seletor "🏢 Consolidado / Empresa A / Empresa B..." que troca o contexto para as abas que fizer sentido (ver seção 6).

6. Aba 1 — DRE Gerencial (visão macro)

Tabela "larga": uma coluna dupla (Realizado + AV% ou AH%) por mês, mais uma coluna "Total Período". Alternância entre AV (Análise Vertical, % do faturamento do mês) e AH (Análise Horizontal, variação % vs. mês anterior) com dois botões.

Estrutura da cascata (nessa ordem exata):

```

FATURAMENTO

  Faturamento — <Empresa 1>          } só aparece se o cliente tiver 2+ empresas

  Faturamento — <Empresa 2>          } (soma das linhas = FATURAMENTO)

(-) DEDUÇÕES

  Cancelamentos e Reembolsos [— por empresa, se 2+]

  Imposto Simples Nacional            } não é atribuível por empresa/marketplace — sempre 1 linha só

(=) RECEITA LÍQUIDA = FATURAMENTO - DEDUÇÕES

  Receita Líquida — <Empresa 1/2...>

(-) CUSTOS

  Custo — <Empresa 1/2...>

(=) LUCRO BRUTO = RECEITA LÍQUIDA - CUSTOS

  Lucro Bruto — <Empresa 1/2...>

(-) DESPESAS VARIÁVEIS = Tarifa de Venda + Tarifas de Envio - Receita por Envio + Cupom + Comissão Afiliado + Frete Entrega Direta

  [cada um dos 6 componentes acima, por empresa, se 2+]

(=) MARGEM DE CONTRIBUIÇÃO = LUCRO BRUTO - DESPESAS VARIÁVEIS

(-) DESPESAS FIXAS

  [uma linha por item de despesa fixa cadastrado naquele mês]

(=) LUCRO LÍQUIDO OU PREJUÍZO = MARGEM DE CONTRIBUIÇÃO - DESPESAS FIXAS

(=) PONTO DE EQUILÍBRIO (FATURAMENTO) — linha de referência ao final, fora da cascata

```

Fórmulas importantes:

`Margem de Contribuição = Lucro Bruto − Despesas Variáveis` (ainda ANTES de descontar as despesas fixas — é o quanto cada venda sobra pra pagar o custo fixo do mês).

`Ponto de Equilíbrio (R$) = Despesas Fixas do mês / (Margem de Contribuição do mês / Faturamento do mês)`. Se a margem de contribuição do mês for ≤ 0, não existe ponto de equilíbrio alcançável só com volume — mostrar "N/D" em vez de um número enganoso (nunca dividir por zero/negativo).

Linhas de `(-) DESPESAS VARIÁVEIS`: "Receita por Envio" é uma contra-conta (normalmente reduz a despesa, aparece negativa/verde quando reduz).

Toda linha síntese (MAIÚSCULA, com `(=)`/`(-)`) deve ser clicável para expandir/recolher os filhos analíticos abaixo dela. Botão "Expandir/Recolher tudo" no topo da tabela.

Célula sem dado disponível mostra "N/D" em vez de zero ou erro (ex: AH do primeiro mês, que não tem mês anterior pra comparar).

Cartões de KPI acima da tabela (Faturamento, Receita Líquida, Lucro Bruto com margem bruta %, Lucro Líquido com margem líquida %, Custos+Despesas), cada um com um mini-gráfico de linha (sparkline) mostrando a evolução mensal. Esses cartões devem reagir ao seletor de mês do topo (mostrar o valor daquele mês específico, não sempre o acumulado).

7. Aba 2 — DRE Detalhado (visão por loja/marketplace)

Só aparece se o cliente tiver 2+ empresas cadastradas (senão a DRE Gerencial já mostra tudo por marketplace nativamente, não tem o que detalhar a mais).

Barra de botões: "🏢 Consolidado (todas as empresas)" + um botão por empresa.

Consolidado: mostra a mesma tabela da DRE Gerencial (aberta por Empresa).

Uma empresa específica: mostra uma DRE reduzida (Faturamento → Margem de Contribuição, sem Despesas Fixas/Lucro Líquido porque despesa fixa não é rastreada por loja) já aberta por Marketplace em Faturamento, Custo, Despesas Variáveis e Margem de Contribuição — já que agora o filtro é uma única empresa, o próximo nível de detalhe natural é o canal de venda.

Mesmos cartões de KPI do topo (Faturamento, Receita Líquida, Lucro Bruto, Margem de Contribuição — sem Lucro Líquido quando uma empresa específica está selecionada), também reagindo ao seletor de mês/Período Total do topo.

Nota visível explicando que a Margem de Contribuição por marketplace pode não bater 100% com a linha síntese quando Cancelamentos não são rastreados por canal (deixe isso configurável: se o schema permitir capturar Cancelamento por linha de produto/marketplace, aí sim reconcilia exato — resolva isso no banco de dados em vez de aproximar, já que aqui dá pra fazer certo).

8. Aba 3 — Análise Gerencial

Duas partes:

a) Gráfico "Tesoura" — dois seletores (Métrica A, Métrica B) com todas as contas da DRE (Faturamento, Receita Líquida, Lucro Bruto, Margem de Contribuição, Lucro Líquido, Margens em %, Ponto de Equilíbrio etc.). O gráfico plota a variação % mês a mês (AH) das duas métricas escolhidas, uma linha para cada, com a área entre elas sombreada — permite ver visualmente se uma métrica está "abrindo" ou "fechando" em relação à outra ao longo do tempo.

b) Participação por Marketplace no Faturamento — gráfico de barras empilhadas a 100%, uma barra por mês, mostrando a composição percentual do faturamento por canal de venda (soma de todas as empresas). Cada marketplace com uma cor fixa.

c) Tabelas de apoio (podem ficar em accordions/seções secundárias):

Tabela de Margens (Bruta %, Contribuição %, Líquida %) por mês.

Tabela de Análise Vertical completa (% de cada linha sobre o Faturamento do mês).

Tabela de Análise Horizontal completa (% de variação de cada linha vs. mês anterior).

9. Aba 4 — Análise por Produto

Tabela de produtos (SKU) do mês selecionado no topo (ou Período Total), com:

Filtros: busca por SKU/nome, dropdown de produto específico (com navegação anterior/próximo), Fornecedor, Marketplace, Situação (Margem positiva / Margem negativa / Custo não cadastrado), ordenação por margem (maior/menor primeiro).

Colunas: SKU, Produto, Fornecedor, Marketplace, Unidades, Receita, Custo, Despesas Variáveis, Margem (R$), Margem (%) com uma barra visual proporcional, Situação (badge colorido).

Contador "X de Y produtos" refletindo os filtros ativos.

10. Aba 5 — Simuladores

Painel de sliders (baseados no Período Total como cenário-base) para simular:

Variação % do Faturamento (-50% a +100%).

Custo como % do faturamento (0-100%).

Despesas Variáveis como % do faturamento (0-60%).

Despesas Fixas — total do período, alternável entre R$ absoluto e %.

Alíquota do Simples Nacional (0-33%).

Ao lado, uma tabela DRE completa comparando Base x Simulado, com colunas de Δ (R$) e Δ (%), recalculada em tempo real a cada ajuste de slider. Botão "Restaurar premissas base".

11. Exportar apresentação

Botão que gera uma apresentação de slides (pode ser um modal de preview + exportar PDF/PPTX, ou uma página imprimível) contendo: capa com nome do cliente, KPIs do período escolhido, DRE Gerencial sintético, evolução mensal (gráfico), desempenho por marketplace, ranking de produtos por margem. Deixe o período (mês específico ou total) escolhível num modal antes de gerar.

12. Estilo visual

Paleta: azul-marinho escuro para a barra superior e cabeçalhos de tabela (`#0d1b3e`/`#1a2f5c` aproximadamente), branco para o corpo, verde para valores positivos/crescimento, vermelho para negativos/queda, dourado/âmbar como cor de destaque para o item ativo (abas, botões selecionados).

Tabelas densas, tipografia tabular (números alinhados à direita, monoespaçados ou tabular-nums) — é uma ferramenta de trabalho, não precisa de espaçamento generoso estilo consumer app.

Números sempre em formato `R$ 1.234,56` (padrão brasileiro) e percentuais com vírgula decimal (`12,3%`).

Cartões de KPI com sombra sutil, cantos arredondados, mini-gráfico de linha no rodapé do cartão.

13. O que NÃO fazer

Não deixe nenhuma tela "presa" no acumulado quando o usuário já selecionou um mês específico no topo — isso foi um bug real da versão anterior e a causa mais comum de reclamação.

Não misture a granularidade Empresa e Marketplace na mesma linha da DRE Gerencial (ela é só por Empresa); o cruzamento fino fica na aba DRE Detalhado.

Não invente/estime Imposto Simples Nacional ou Despesas Fixas por canal de venda quando o dado não existir — mostre a limitação claramente (ex: "não atribuível por canal") em vez de ratear artificialmente.


Em anexo, segue modelo HTML a ser usado. utilize exatamente o mesmo layout e cores.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6a4e8851-e419-4f6e-ad0c-6a172f41ff3b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

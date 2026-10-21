# Recuperação de carrinhos: conferência de 90 dias

## Escopo e dependência

Este patch altera apenas o bloco `SalesFunnel` do painel e adiciona uma rota de leitura autenticada. Não altera o card de vendas do atendimento da PR #60, não modifica os dados históricos e não envia WhatsApp. A publicação exige a versão correspondente do endpoint de reconciliação no repositório `whatsapp-api`, incluindo cache incremental e metadados de atualização. O título é “Recuperação de carrinhos · últimos 90 dias”.

O navegador consulta `GET /api/dashboard/cart-recovery`. Após validar a sessão e o perfil de administrador, o painel chama exclusivamente `GET /api/admin/cart-recovery/reconcile` na API configurada no servidor. A chave interna é obrigatória, inclusive em loopback. Nenhuma loja, URL, chave ou janela pode ser escolhida por parâmetros do navegador.

## Período e significado financeiro

- São 90 dias de calendário no fuso `America/Sao_Paulo`, incluindo o dia da conferência: início à meia-noite de 89 dias antes, fim exclusivo no instante definido pelo servidor.
- Exemplo em 21/10/2026 às 11:30 de Brasília: de 24/07/2026 às 00:00 até 21/10/2026 às 11:30.
- A data financeira é a de pagamento comprovado na Nuvemshop, posterior ao envio comprovado da recuperação. A criação do carrinho não define o período da compra recuperada.
- O valor principal usa `productsCents`: valor pago após descontos, descontando o frete cobrado do cliente. Não é lucro e não desconta taxas do meio de pagamento ou custos dos produtos. `grossCents` preserva o total pago incluindo frete no contrato, sem ser somado duas vezes.
- Compra e carrinho exigem atribuição exata do pedido e do link de recuperação. Telefone, nome, simples geração de checkout ou flag histórico `recovered` não são prova financeira.
- Pedidos cancelados, reembolsados, parcialmente reembolsados, autorizados ou pendentes não devem ser contabilizados pelo endpoint financeiro.
- `Recuperações enviadas` conta carrinhos com envio comprovado dentro do período. Esse denominador pode ter coorte diferente dos pagamentos da janela; por isso a antiga taxa foi removida, não recalculada.

## Contrato v1 e privacidade

A rota reconstrói uma resposta allowlist, descartando campos extras. Nunca retorna pedidos, clientes, telefones, tokens, URLs de recuperação, configurações ou corpos de erro do upstream. Só há agregados, intervalo, horário da conferência, contadores de cobertura, limitações enumeradas e indicadores de cache/progresso.

Valores em centavos e contagens são inteiros não negativos seguros. Ausência, tipos inválidos, inconsistências, janela incorreta e erros não são convertidos em zero. A resposta é privada e `no-store`; redirecionamentos não são seguidos e só existe uma tentativa de rede por requisição. O corpo aceito é limitado a 32 KiB.

Campos de cobertura: `checkedOrders`, `scannedCarts`, `scannedMessages`, `orderPages`, `latestOrderUpdatedAt`, `unresolved`, `paymentTimestampOrders`, `missingPaymentTimestampCandidates`, `inProgress`. Em v1, `paymentTimestampOrders` é igual a `confirmedOrders` (ou zero quando não há contagem disponível).

O campo opcional `freshness` contém somente `mode` (`full` ou `incremental`), `state` (`idle`, `running` ou `failed`), `lastCompletedAt`, `lastFullScanAt` e `refreshIntervalSeconds: 60`. Datas não são renovadas por uma simples tentativa. Diagnósticos técnicos e campos extras não atravessam a rota do painel.

## Incompletude, atualização e falhas

- Completo: os valores, incluindo zero, podem ser exibidos somente com todas as verificações concluídas e sem lacunas declaradas.
- Parcial: positivos aparecem como mínimo comprovado (`≥`); zeros e valores indisponíveis aparecem como travessão. O aviso declara que o total real ainda não foi confirmado.
- Automático: enquanto o painel está aberto e visível, a consulta é repetida 60 segundos após terminar a anterior; após falha, também em 60 segundos. Ao voltar à aba, confere novamente. Não é uma promessa de tempo real nem um processo de navegador executado com o painel fechado. Não é necessário executar um utilitário a cada venda.
- Varredura em andamento: cada GET já processa uma fatia limitada no servidor. A próxima fatia começa 1 segundo após a resposta anterior, sem sobreposição, para que a primeira leitura longa avance. Abas ocultas não iniciam novas consultas. A requisição ativa é cancelada ao desmontar o componente.
- Atualização incremental: o backend reutiliza a base de pedidos e consulta alterações recentes, com sobreposição segura, em vez de ler os 90 dias inteiros a cada atualização. A revisão completa periódica e os reinícios são responsabilidade do backend. O painel nunca escolhe loja, datas ou modo de varredura.
- Durante atualização com uma base anterior, conserva-se o snapshot concluído e sua janela/data original. A tela sinaliza “Atualizando automaticamente”, sem apresentar os valores antigos como um mínimo atual. Depois da conclusão, aceita aumentos e reduções, incluindo exclusões por reembolso ou cancelamento.
- Falha posterior: conserva positivos da última conferência, explicitamente antigos; não transforma a falha em zero nem mantém a indicação de mínimo atual.
- Cache não muda `checkedAt`. Após 15 minutos sem conferência, a tela sinaliza desatualização e não apresenta zeros ou mínimos como atuais.
- Lacunas históricas de envio, pagamento, token ou cobertura podem deixar o resultado parcial mesmo que a API esteja respondendo. Pedidos sem data de pagamento comprovada e outras pendências aparecem separados dos valores confirmados. Não é necessário resolver todas as pendências para exibir as recuperações comprovadas. A implementação não preenche lacunas com inferências nem apaga histórico.

## Verificação local

`node --test tests/*.test.cjs`

`npx tsc --noEmit`

`npx eslint lib/cart-recovery-summary.ts app/api/dashboard/cart-recovery/route.ts 'app/(admin)/dashboard/components/SalesFunnel.tsx' tests/cart-recovery-summary.test.cjs`

Os testes focados cobrem período/fuso, limites e tipos, parcial/zero, cache e defasagem, autorização antes da rede, rota fixa, chave obrigatória, sanitização, resposta excessiva, erros sem retries, preservação de resultado, abort de navegação, deduplicação de consultas, pausas ao ocultar a aba, retomada, polling automático, metadados de freshness, diminuição após reembolso e separação das pendências. A comprovação de IDs, pagamentos, cancelamentos, reembolsos e fontes pertence à suíte do endpoint no backend; este frontend não tenta substituir essa conferência.

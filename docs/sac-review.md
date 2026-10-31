# SAC: revisão de propostas, sem execução

Base do painel: andressa295/modapink, c5acafa99c0a15f59e5b1408c97fe748b63b3f4d (main verificada em 31/10/2026). Entrega local aditiva; nenhum arquivo existente foi alterado.

## Entrada e limites

- Página isolada `/sac-revisao`, fora do layout do dashboard para não montar o sincronizador automático de pedidos existente.
- Página e API `/api/sac-preview/:id` ficam indisponíveis por padrão. Exigem a opção server-only `SAC_REVIEW_ENABLED=true`, que **não foi configurada nesta entrega**.
- Exige sessão válida e perfil `admin` verificado no servidor. Os papéis atuais não distinguem SAC: não foi criado papel, alterado perfil nem ampliado permissão. O acesso de Aline não foi verificado.
- O operador informa o UUID da conversa; não há listagem global nem busca de clientes. A API confirma visibilidade com o cliente Supabase da sessão (RLS) e exige `session_key` e `session_id` iguais a `sac`.
- Usa a configuração server-only existente da API WhatsApp e chave interna obrigatória, inclusive em loopback. Nenhuma chave é passada ao navegador; não há criação ou configuração de credenciais.
- A classificação como cliente é confirmação explícita do operador e **não prova identidade do pedido**. A consulta opcional de pedido delega a verificação exata ao adaptador SAC da API.
- O menu normal de sete opções continua como entrada do SAC. A revisão exibe o assunto e a proposta posterior. Não envia a proposta, não aprova reembolso/troca, não grava caso e não altera pedidos.
- Os contadores `sent=0/persisted=0` referem-se somente à proposta. Não descrevem efeitos das mensagens, menus ou preferências existentes na API.
- Buffer de propostas do componente API: até 50 conversas, expiração de 15 minutos. Esta tela não cria histórico persistente. Consulta após expiração retorna ausência; não simula sucesso.
- Apenas GET, sem endpoints de executar/aprovar. Resposta é reduzida a campos de apresentação; estado privado, telefones e detalhes de mensagens não são encaminhados. Proposta textual ainda pode conter informação de pedido verificada, por isso permanece protegida por autenticação, RLS, no-store e ausência de armazenamento local.

## Testes locais

`node --test tests/sac-preview.test.cjs` cobre flag desligada, autenticação, papéis recusados, RLS, sessão errada, chave obrigatória, parâmetros/UUID, transporte sem redirect, saída mínima, respostas inválidas e nenhum endpoint de escrita.

A suíte existente continua intacta. O build usa dependências locais preexistentes e valores fictícios de ambiente para importações antigas; não é instalação limpa nem teste com conta real.

A interface invalida resultados ao mudar conversa ou opções e aborta consultas anteriores; respostas tardias são descartadas. Renderização/fluxos em navegador real ainda precisam ser validados: Chromium foi bloqueado pelo ambiente ao abrir socket. O roteiro sintético local não foi executado no navegador.

## Próximas verificações antes de publicar/ativar

1. Revisar conjunto API + painel e confirmar configuração da loja e conexão runtime, sem fornecer chaves em conversa.
2. Confirmar acesso autorizado da pessoa revisora sem ampliar papéis silenciosamente.
3. Validar desktop/mobile, login, expiração de sessão, consulta e troca rápida de conversa em ambiente de teste.
4. Autorizar separadamente publicação e ativação. Esta entrega não inclui push, PR, deploy, mudança de banco, flag ligada ou envio ao WhatsApp.
5. Aprovação executável e histórico permanente são etapas futuras; não chamar esta página de sistema de aprovação final.

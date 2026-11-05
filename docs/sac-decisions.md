# Decisão sobre resposta SAC — acesso cadastrado ao atendimento

A página `/sac-decisoes` permite consultar e aprovar/rejeitar **somente uma resposta exata** do workflow SAC. Aprovar não envia mensagem, não aprova reembolso, não autoriza troca/envio e não altera pedidos. O executor de envio é separado e não é chamado por estas rotas.

## Condições e limites

- Gate server-only `SAC_REVIEW_DECISIONS_ENABLED=true`, não configurado nesta entrega. O workflow API também exige seu próprio gate e persistência preparada; não houve migração, configuração ou ativação.
- Pessoa autenticada com perfil cadastrado `admin`, `agent` ou `user`, confirmado no servidor; visibilidade RLS da conversa, `session_id` e `session_key` iguais a `sac` e chave interna server-only obrigatória. Perfis ausentes ou desconhecidos continuam negados. Não há alteração dos perfis, de RLS ou de permissões administrativas.
- POST exige origem canônica configurada em `SAC_REVIEW_ORIGIN` (ou `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_APP_URL`) e cabeçalho Origin correspondente. Sem configuração/origem válida, nega. Nenhuma variável foi alterada no serviço.
- O navegador envia apenas versão esperada, ID/hash da proposta e decisão. Operador e sessão são vinculados no servidor, nunca aceitos do navegador.
- A versão precisa coincidir atomicamente na API. Resultado confirmado precisa corresponder à decisão solicitada, mesmo ID/hash e versão incrementada. O texto exibido é conferido pelo hash SHA-256 no proxy.
- O outbox inclui validade em epoch milissegundos; a UI verifica antes de decidir, e a API aplica a validade na transação. Nenhum prazo é inventado no painel.
- Conflito exige consulta nova. Falha, timeout ou resposta inconclusiva bloqueiam nova decisão até consultar; não há retry automático.
- API GET retorna estado e proposta; proxy remove estado privado, ator, tentativa e ID do provedor. Respostas são no-store, byte-limitadas, sem logs de conteúdos ou chaves.
- Tela independente do layout dashboard para não disparar sincronização de pedidos. Com a opção de decisões ativa, uma conversa SAC selecionada mostra “Conferir resposta do SAC”. O link preenche somente o identificador validado; a pessoa ainda precisa consultar e confirmar a decisão. A volta abre a aba SAC. Com a opção desligada, o link não aparece.

## Verificação

Testes locais cobrem papel/escopo, defaultoff, origem ausente/externa, corpo limitado e allowlist, ator forjado, versão/hash/expiração, confirmação incompatível, retorno incerto, transporte único, stripping e ausência de dispatch. Contrato foi comparado com o repositório real **em memória**, sem banco/rede.

UI: controles de decisão precisam de aceite explícito; trava síncrona evita duplo clique; consulta em andamento é invalidada ao trocar conversa. Esses guardas foram revisados em código. QA visual e execução de corridas em navegador continuam pendentes pela restrição de socket do ambiente. Live RLS/persistência não foram testados.

A mudança de acesso de 05/11/2026 é local, baseada no commit 6281c925384e9ff0f6fe9c7932d9cea634a3ae53: amplia somente as páginas e APIs SAC para os perfis cadastrados de atendimento, sem push/PR/deploy, envio de WhatsApp, mudança no banco real ou ativação de opções. Campanhas, números, usuários, relatórios, pedidos e configurações continuam exclusivos de administradores.

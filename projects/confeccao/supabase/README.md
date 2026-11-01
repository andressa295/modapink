# Banco da Confecção Moda Pink

Base preparada para um projeto Supabase dedicado à confecção. **Estrutura aplicada** no projeto `ragyjbrbhfataoiosgqy`, organização Confeccção Moda Pink. As migrações remotas registram a instalação. Não executar o schema novamente sobre a estrutura existente. Os testes adicionais locais usam PostgreSQL embarcado e identidades sintéticas. Há uma identidade Auth criada por convite, com e-mail confirmado e senha pessoal definida, e um perfil administrador ativo. O endereço da destinatária e seu UUID Auth não são salvos no repositório.

## Instalação e próximos passos

A instalação e a auditoria foram concluídas pelas migrações registradas em `deployment-status.json`. O schema `mf_private` permanece fora do Data API, o bucket é privado e o aplicativo publicado recebe somente URL e chave publicável. Chaves administrativas/`service_role` nunca entram no navegador.

O Auth por e-mail/senha já foi configurado no painel:

- Site URL oficial: `https://modapink-confeccao.vercel.app`.
- Redirects autorizados exatos: `https://modapink-confeccao.vercel.app/auth/recovery` e `https://modapink-confeccao.vercel.app/auth/confirm`.
- Callback anterior do ChatGPT removido da lista autorizada.
- Cadastro público desligado: `/auth/v1/settings` confirmou `disable_signup: true`.
- Provedor de e-mail habilitado: o mesmo endpoint confirmou `external.email: true`.
- SMTP personalizado Resend habilitado: host `smtp.resend.com`, porta `465`, nome de remetente “Confecção Moda Pink”. A configuração persistiu após recarregar o painel; credenciais não são gravadas no repositório.
- Convite enviado; o envio ocorreu em `2026-10-31T23:46:57.288Z`, com status `delivered` confirmado pelo Resend, com recibo sem destinatário em `deployment-status.json`.
- Template de convite do Supabase em português, assunto “Crie sua senha — Confecção Moda Pink”, usando `{{ .ConfirmationURL }}`; cópia em [email-templates/invite.html](email-templates/invite.html).

O bootstrap da primeira administradora já foi executado por operador, com bloqueio da fábrica, rejeição de administrador ativo existente e exigência de e-mail confirmado e senha definida. Foram verificados `role = 'admin'`, `active = true`, e-mail confirmado, senha definida e exatamente um administrador ativo. A revisão da fábrica foi incrementada. **Não repetir o bootstrap**, inclusive o arquivo de referência `bootstrap-admin.psql`; nenhuma senha foi gerada, alterada ou revelada pelo procedimento.

Única pendência de validação: testar o fluxo completo da aplicação no navegador com sessão autenticada, incluindo login, expiração, recuperação, negação para usuário sem perfil, permissões de cada área e upload/leitura privada no serviço real. Esses fluxos ainda não foram verificados de ponta a ponta com a conta provisionada.

A publicação Vercel corrigida está READY, com recibo em `deployment-status.json`; o Site anterior no ChatGPT foi excluído. A verificação do fluxo autenticado permanece pendente.

A criação de identidades Auth adicionais exige fluxo administrativo no servidor ou execução verificada no painel Supabase. O RPC de perfis gerencia somente perfis já provisionados. A interface não oferece cadastro e não promove automaticamente o primeiro visitante a administrador. O endpoint de cadastro do Supabase já está desativado. Identidades sem perfil ativo não têm acesso aos dados da confecção.

## Objetos

`public.profiles` tem SELECT com RLS para o próprio usuário e para gestão/admin; o navegador não recebe INSERT, UPDATE ou DELETE. Nenhum `user_metadata` decide permissões.

As tabelas operacionais ficam em `mf_private`: materiais, modelos, tamanhos, ordens, grade, conferências, movimentos, eventos e recibos idempotentes. Todas usam RLS e nenhuma permite escrita direta de `anon`/`authenticated`.

Os RPCs públicos são wrappers `SECURITY INVOKER`. As implementações privilegiadas ficam no schema privado, com `search_path` vazio, revogação de EXECUTE padrão e verificação do perfil ativo em cada operação. Esse privilégio controlado existe para executar comandos transacionais sem liberar edições arbitrárias de saldo ou promoção de perfis.

## Contrato dos RPCs

```ts
mf_get_profile(): { id: string; name: string; role: Role; active: boolean }

mf_get_state(): {
  profile: { id: string; name: string; role: Role; active: boolean };
  revision: number;
  canViewCosts: boolean;
  state: {
    version: 1; materials: Material[]; models: Model[]; orders: Order[];
    inspections: Inspection[]; activity: Activity[];
    dailyApprovals: { date: string; quantity: number }[];
  };
}

mf_apply_command({
  p_command: { type: string; expectedRevision: number; payload: object },
  p_request_id: string // UUID distinto por ação, reutilizado somente no retry dessa mesma ação
}): StateEnvelope & { requestId: string; replayed: boolean }

mf_list_profiles(): { id: string; full_name: string; role: Role; active: boolean }[]
mf_set_profile({p_user_id, p_full_name, p_role, p_active}): Profile[]
```

O retorno usa os campos camelCase do domínio do aplicativo. `image` é `null` ou um caminho de objeto, nunca uma URL assinada nem data URI. Ordens retornam ainda `modelSnapshot` e `consumptionPerPiece` imutáveis, além do preço do tecido na abertura, preservando custos históricos.

`state.dailyApprovals` soma conferências aprovadas na data original e peças de retrabalho na data da reconferência, no fuso de São Paulo. A base começa vazia, sem exemplos de produção.

### Comandos e permissões

| Tipo | Payload | Perfis autorizados |
| --- | --- | --- |
| `create_material` | Campos Material, ignorando `id` e `reserved` do cliente | admin, gestao |
| `move_material` | `{id, amount, kind: 'Entrada'\|'Perda', note}` | admin, gestao, producao |
| `create_model` | Campos Model, ignorando `id` do cliente | admin, gestao |
| `update_model_image` | `{id, image: string\|null}` | admin, gestao, producao |
| `create_order` | `{modelId, materialId, variants, due, team, priority}` | admin, gestao, producao |
| `advance_order` | `{orderId, consumption?}` | admin, gestao, producao; qualidade apenas para concluir um lote já conferido |
| `inspect_order` | `{orderId, quantity, result, reason, notes?, image?}` | admin, gestao, qualidade |
| `resolve_inspection` | `{id}` | admin, gestao, qualidade |

As permissões de custo são aplicadas no banco: `producao` e `qualidade` recebem os campos monetários zerados. A interface pode ocultar a área financeira para esses perfis, mas a segurança não depende dessa ocultação.

### Concorrência e integridade

Cada comando bloqueia a revisão da fábrica, verifica `expectedRevision` e aplica a movimentação, a auditoria e o recibo na mesma transação. O cliente deve recarregar ao receber `40001`; não deve reenviar automaticamente uma ação com outra revisão sem a pessoa conferir os dados.

O mesmo `p_request_id`/ator/comando não repete a operação. Reutilizar o identificador com outro comando ou outra pessoa é rejeitado. Essa serialização é adequada à primeira operação da fábrica; operações maiores deverão evoluir para comandos/páginas parciais e bloqueios por agregado, preservando os testes.

## Imagens

Bucket `confeccao-images`, **privado**, com limite de 5 MB e MIME JPEG/PNG/WebP. Caminhos aceitos:

- `models/<UUID>.webp` (também `.jpg`, `.jpeg`, `.png`)
- `inspections/<UUID>.webp` (mesmas extensões)

Membros ativos leem as imagens da fábrica. Produção/gestão/admin enviam fotos de modelos; qualidade/gestão/admin enviam fotos de conferência. Alterações e exclusões ficam limitadas ao autor do upload ou à gestão/admin. O banco verifica que o objeto existe antes de gravar a referência.

As URLs assinadas são geradas na leitura e não são armazenadas no banco. A configuração do serviço e as políticas ainda precisam de um teste real de upload/download com a conta já provisionada; o teste local verifica somente o contrato SQL e as políticas PostgreSQL.

## Testes locais

O teste é independente do banco da cliente. Ele cria Auth/Storage mínimos em memória e executa o SQL completo sobre PostgreSQL embarcado:

```sh
npm --prefix supabase/tests ci
npm --prefix supabase/tests test
```

Verifica: base vazia, reserva, consumo efetivo, idempotência, revisão desatualizada, validação de grade e quantidades, bloqueio de conclusão, retrabalho uma única vez, aprovação diária, snapshots imutáveis, ocultação de custos, rejeição de NaN, escrita direta negada, regras de acesso, último administrador, perfil desconhecido/inativo, bucket privado e usuário anônimo.

## Auditoria após aplicação

Todas as tabelas da aplicação têm RLS. Os alertas de EXECUTE público do helper `public.rls_auto_enable()` foram corrigidos revogando EXECUTE de PUBLIC/anon/authenticated; a função continua disponível para seu event trigger de plataforma.

Os avisos informativos de [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) nas tabelas `mf_private` são intencionais: acesso direto negado, com operações feitas somente pelas funções privadas autorizadas. As tabelas e funções privadas não devem ser expostas como API.

## Portal de confecções instalado

A migração `20261101000759_create_partner_production_portal` aplicou `partner-portal.sql` uma única vez no projeto. Não executar novamente. São cinco novas tabelas privadas, todas com RLS: parceiras, atribuições de ordens, links, reservas de fotos e apontamentos imutáveis. Com o núcleo, existem 16 tabelas da aplicação. No Table Editor, trocar o schema `public` por `mf_private` para inspecionar os registros operacionais.

As funções `mf_portal_owner_state` e `mf_portal_manage` exigem perfil ativo; o gerenciamento exige administração ou gestão. As funções `mf_portal_get`, `mf_portal_submit`, `mf_portal_prepare_upload` e `mf_portal_release_upload` exigem capacidade válida mesmo sem login. Um link por confecção, revogável, válido por 30 dias e salvo apenas como hash. Somente OPs atualmente atribuídas são projetadas, sem campos financeiros. Os apontamentos não alteram estoque, aprovação de qualidade ou encerramento oficial.

Os testes PostgreSQL locais cobrem isolamento, revogação/expiração/rotação, replay, imutabilidade, contagens, atribuições, OP concluída e políticas de imagens. O serviço real rejeitou RPC interno sem sessão e token inválido; o preflight Storage permitiu o cabeçalho adicional. Upload/download positivo com dados reais permanece pendente. Não há parceiras, links nem OPs de teste inseridos pelo desenvolvimento na produção.

A auditoria de segurança encontrou somente os avisos informativos de RLS sem políticas nas tabelas privadas (negação deliberada, acesso por RPC protegido) e o aviso preexistente de proteção de senhas vazadas desativada no Auth. Não foram abertos privilégios diretos para remover os avisos informativos.

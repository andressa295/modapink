# Banco da Confecção Moda Pink

Base preparada para um projeto Supabase dedicado à confecção. **Estrutura aplicada** no projeto `ragyjbrbhfataoiosgqy`, organização Confeccção Moda Pink. As migrações remotas registram a instalação. Não executar o schema novamente sobre a estrutura existente. Os testes adicionais locais usam PostgreSQL embarcado e identidades sintéticas. As contas Auth reais ainda aguardam e-mails confirmados.

## Instalação e próximos passos

A instalação e a auditoria foram concluídas pelas migrações registradas em `deployment-status.json`. O schema `mf_private` permanece fora do Data API, o bucket é privado e o aplicativo publicado recebe somente URL e chave publicável. Chaves administrativas/`service_role` nunca entram no navegador.

1. Configurar o Auth com e-mail/senha, cadastro público desativado e URLs exatas de login/recuperação da publicação. Configurar envio de e-mail antes de depender de convite/recuperação.
2. Criar a primeira identidade Auth com o e-mail confirmado pela responsável. Sem inferir identidades da agência ou da equipe.
3. Após a confirmação do e-mail da identidade, provisionar o primeiro perfil administrador executando `bootstrap-admin.psql` como operador do projeto. O script solicita e-mail e nome de exibição e não gera, altera ou revela senha.
4. Validar login, expiração, recuperação, negação para usuário sem perfil, permissões de cada área e upload/leitura privada no serviço real.

A criação de identidades Auth adicionais exige fluxo administrativo no servidor ou execução verificada no painel Supabase. O RPC de perfis gerencia somente perfis já provisionados. A interface não oferece cadastro e não promove automaticamente o primeiro visitante a administrador. O endpoint de cadastro do Supabase ainda está habilitado e precisa ser desativado no Auth; identidades sem perfil ativo não têm acesso aos dados da confecção.

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

As URLs assinadas são geradas na leitura e não são armazenadas no banco. A configuração do serviço e as políticas precisam de um teste real de upload/download após o provisionamento da primeira conta; o teste local verifica somente o contrato SQL e as políticas PostgreSQL.

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

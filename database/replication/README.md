# Banco reutilizavel do Phand Core

Este diretorio prepara a captura do banco compartilhado pelo painel `modapink` e pela
API `whatsapp-api`. **O banco real ainda nao foi consultado por estes arquivos.**
`repository-inventory.json` registra somente o que foi verificado nos dois repositorios.
Uma captura so vira a baseline do Core depois da comparacao com producao e de uma
restauracao bem-sucedida num Supabase vazio.

O `database/schema.sql` antigo e um historico de comandos do SQL Editor: contem
politicas repetidas, renomeacoes de colunas ausentes e alteracoes sem `IF NOT EXISTS`.
Nao e a baseline reproduzivel de uma instalacao nova. As migrations de ambos os
repositorios tambem dependem de objetos criados anteriormente no banco real.

## Capturar o banco de origem

Use PostgreSQL client tools (`psql` e `pg_dump`) compativeis com a versao do servidor.
Configure a conexao no ambiente libpq: `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` e
autenticacao via `.pgpass` ou `PGPASSWORD`. Prefira o Session pooler do Supabase quando
a rede nao tiver IPv6. Nao use o pooler em modo transaction para o dump.
`PHAND_SOURCE_PROJECT_REF` identifica a origem no registro da captura.

```bash
node scripts/database/export-schema.mjs
```

O comando faz apenas leituras. `catalog.sql` pode ser executado separadamente no
SQL Editor ou na integracao Supabase para levantar tabelas, colunas, constraints,
indices, views, tipos, funcoes, triggers, RLS, grants e publicacoes Realtime.
Nao consulta linhas de clientes, mensagens, pedidos ou usuarios.

A captura local, ignorada pelo Git, contem `schema.raw.sql`, `schema.sql`,
`catalog.json`, `managed-review.json` e `capture-status.json`. Nao fazer alteracoes
de estrutura enquanto a captura roda: catalogo e dump sao leituras separadas.
Funcoes, defaults e comentarios podem conter URLs/chaves de integracoes; revisar
esses literais e tornar configuraveis os valores de cada loja antes de versionar.

Schemas administrados pelo Supabase (`auth`, `storage`, `realtime` e outros) nao
sao substituidos por um dump bruto. Revisar separadamente triggers/policies personalizados,
funcoes/indices nesses schemas, extensoes, roles proprias, buckets, cron e Edge Functions.
O inventario identifica triggers que chamam funcoes da aplicacao e policies nesses
schemas; ele nao equivale ao diff completo do ambiente gerenciado.
A configuracao dos provedores de Auth, URLs de redirecionamento e SMTP fica fora do
schema SQL e precisa ser configurada no projeto novo.

## Transformar a captura em baseline

1. Comparar o catalogo real com `repository-inventory.json`. Confirmar tambem objetos
   que existem no banco e nao aparecem no codigo.
2. Habilitar extensoes/roles necessarias no Supabase de teste e preparar uma migration
   separada para personalizacoes dos schemas gerenciados e Realtime.
3. Revisar o dump, retirar credenciais e personalizar somente valores de configuracao.
4. Restaurar `schema.sql` num projeto **novo e vazio**, usando `psql -X -v ON_ERROR_STOP=1
   --single-transaction --file caminho/schema.sql` com a conexao do destino no ambiente.
5. Comparar catalogos de origem/destino e testar painel, login, permissao de atendente,
   conversas, pedidos, memoria, automacoes, SAC, campanhas e midias.
6. Versionar o SQL validado em `supabase/migrations/<timestamp>_phand_core_baseline.sql`,
   as personalizacoes revisadas, um seed limpo e a configuracao de Auth sem segredos.

O snapshot ja inclui as alteracoes aplicadas no banco de origem. Nao reaplicar
automaticamente as migrations historicas por cima dele: isso pode duplicar funcoes,
politicas ou backfills. O seed da nova loja nao leva contatos, contas, mensagens,
pedidos, memorias, tokens Nuvemshop nem sessoes WhatsApp da Moda Pink.

A API usa o bucket `whatsapp-media`, publico e com limite de 25 MiB, e tenta cria-lo
quando precisa armazenar uma midia. Confirmar essa configuracao e as policies no
destino; os arquivos da loja de origem nao sao parte da estrutura reutilizavel.

## Criar o primeiro login de uma instalacao nova

O login atual usa Supabase Auth e uma linha em `public.profiles` com o mesmo `id` e
`role = 'admin'`. Criar somente uma dessas partes nao libera o painel.

Informe no ambiente local da instalacao:

| Variavel | Valor |
|---|---|
| `PHAND_TARGET_SUPABASE_URL` | URL HTTPS padrao do projeto novo |
| `PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY` | Chave de servidor do projeto novo |
| `PHAND_EXPECTED_PROJECT_REF` | Identificador esperado do destino |
| `PHAND_SOURCE_PROJECT_REF` | Identificador do banco de origem |
| `PHAND_ADMIN_EMAIL` | E-mail do primeiro administrador |
| `PHAND_ADMIN_NAME` | Nome do primeiro administrador |
| `PHAND_ADMIN_PASSWORD` | Senha inicial de pelo menos 12 caracteres |

```bash
node scripts/database/create-admin.mjs
node scripts/database/create-admin.mjs --apply
```

O primeiro comando apenas valida a configuracao; o segundo cria Auth e perfil. O
script bloqueia o projeto da Moda Pink, exige confirmacao explicita do identificador
de destino e recusa bancos com perfis/contas existentes. Se o perfil falhar, tenta
remover somente a conta criada por aquela tentativa. Uma falha de rede pode deixar
resultado remoto incerto; nesse caso conferir o projeto antes de repetir.
Senha e chave nunca sao impressas ou salvas pelo script. Nao existe senha universal
nem password de cliente dentro do Git. Para os proximos usuarios, o painel atual
usa seu fluxo de criacao/convite, com nome, e-mail e funcao.

## Validacao local

```bash
node --test tests/database-bootstrap.test.mjs
```

Os testes simulam as respostas HTTP, verificam o bloqueio da origem, a criacao dos
dois registros, o rollback e a exportacao somente de estrutura. Nao equivalem a
executar a baseline ou testar login num Supabase real.

Referencias: [Backup/restore Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html).

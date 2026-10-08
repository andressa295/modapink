# Banco reutilizável do Phand Core

O banco real da Moda Pink foi consultado em **8 de outubro de 2026**, somente por
leituras. A estrutura está versionada em `supabase/migrations/` e foi recriada e
comparada em PostgreSQL 17 isolado. Painel e API compartilham esse banco; cada nova
loja deve usar **outro projeto Supabase**, com suas próprias chaves.

A origem tem **27 tabelas, uma view, 354 colunas contando a view, 70 constraints,
83 índices, três funções, um event trigger de aplicação e 20 policies** (17 em
public, três em storage). Não havia migrations registradas no Supabase nem Edge
Functions. `source-schema-manifest.json` registra o catálogo;
`repository-inventory.json` cruza a estrutura com os commits analisados nos dois repos.

## SQL de uma instalação nova

Os nomes foram criados pelo CLI 2.120.0, com `supabase migration new`.
Aplicar todas as migrations, em ordem, antes de configurar integrações:

| Migration | Conteúdo |
|---|---|
| `20261008013636_phand_core_live_schema.sql` | Snapshot de tabelas, colunas, FKs, índices, view, funções, policies e grants de public; RLS automático; extensões da aplicação |
| `20261008013637_phand_core_runtime_and_access.sql` | SAC e eventos Meta previstos no código; permissões de admin/atendente; perfil padrão agent; proteção contra autopromoção |
| `20261008013639_phand_core_storage_realtime.sql` | Dois buckets vazios, policies de mídia e publicação de public.messages no Realtime |

A instalação final tem **29 tabelas e uma view**. `sac_cases` e
`meta_whatsapp_events` estavam nas migrations da API, mas não no banco consultado:
são complementos do código, e não tabelas exportadas da produção.
A tabela auxiliar `abandoned_carts_demo_backup` tem a estrutura preservada, sem
conteúdo e sem acesso pelo navegador. Schemas administrados pelo Supabase em auth,
storage, realtime e vault não são substituídos por dumps. Não foram encontradas
funções ou relações próprias do usuário nesses schemas; triggers internos e
roles da plataforma permanecem sob sua administração.

A primeira migration guarda as permissões antigas para comparação. A segunda
estabelece o acesso do Core: administrador gerencia a loja; atendente/usuário com
perfil válido lê o chat; anon não acessa tabelas da loja; integrações usam
service_role no servidor. Profiles é a fonte da função de cada usuário, e usuários
comuns não editam sua própria função. Helpers de policies ficam em private, fora
dos schemas expostos na API. A view usa security_invoker e funções de negócio
respeitam RLS. Não executar apenas a primeira migration.

**Baseline exclusiva para projeto novo e vazio.** A primeira migration interrompe
a execução se já houver tabela de aplicação em public, antes de qualquer DDL.
Não aplicar no projeto `wpzqnfvuczqnpuvuxdlx` da Moda Pink. Não reaplicar o antigo
`database/schema.sql` nem migrations históricas da API por cima do snapshot.

Após criar um Supabase vazio com PostgreSQL 17, configure o identificador certo em
`PHAND_EXPECTED_PROJECT_REF`, autentique o CLI e, na raiz deste repositório:

```bash
supabase link --project-ref "$PHAND_EXPECTED_PROJECT_REF"
supabase db push --linked --skip-vault --dry-run
supabase db push --linked --skip-vault
```

Use o prompt/ambiente do CLI para credenciais. Não salvar senha ou chave de servidor
no Git. O seed é vazio; somente as configurações de buckets são inseridas:

| Bucket | Público | Limite exato | Tipos permitidos |
|---|---|---|---|
| whatsapp-media | sim | 25.000.000 bytes | sem restrição no catálogo de origem |
| broadcast-media | sim | 20.971.520 bytes | JPEG, PNG, WebP, MP4 e WebM |

O limite real de whatsapp-media é 25 MB decimais; o fallback antigo da API declara
25 MiB. A configuração real foi preservada. Mídia em bucket público continua
acessível por URL pública. Escrita/exclusão de campanha exige admin;
whatsapp-media recebe gravações do backend. Nenhuma linha de storage.objects é copiada.

## Criar o primeiro login

O login usa Supabase Auth e um perfil com `id = auth.users.id` e `role = 'admin'`.
Informe no ambiente local da instalação:

| Variável | Valor |
|---|---|
| `PHAND_TARGET_SUPABASE_URL` | URL HTTPS padrão do projeto novo |
| `PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY` | Chave service_role de servidor do projeto novo |
| `PHAND_EXPECTED_PROJECT_REF` | Identificador esperado do destino |
| `PHAND_SOURCE_PROJECT_REF` | Identificador do banco de origem |
| `PHAND_ADMIN_EMAIL` | E-mail do primeiro administrador |
| `PHAND_ADMIN_NAME` | Nome do primeiro administrador |
| `PHAND_ADMIN_PASSWORD` | Senha inicial de pelo menos 12 caracteres |

```bash
node scripts/database/create-admin.mjs
node scripts/database/create-admin.mjs --apply
```

O primeiro comando valida sem escrever; o segundo cria Auth com e-mail confirmado e
perfil admin. Nome vai em user_metadata; o marcador admin vai em app_metadata e
profiles. O painel autoriza por profiles. O script bloqueia a Moda Pink/origem,
exige identificador de destino compatível e recusa bancos com perfis/contas existentes.
Se o perfil falhar, tenta remover somente os registros daquela tentativa. Uma falha
de rede pode deixar resultado remoto incerto: conferir o projeto antes de repetir.
Chave e senha não são impressas ou salvas. Não existe senha universal no repositório.
Os próximos usuários seguem o fluxo de criação/convite do painel.

## Configuração de cada loja

`supabase/config.toml` configura o ambiente **local**: PostgreSQL 17, Auth por e-mail,
cadastro público desativado, senha mínima 12, confirmação de e-mail e URLs de
desenvolvimento. Ele não captura o Auth atual nem altera automaticamente o projeto
hospedado. No projeto novo, habilitar e-mail, desativar cadastro público, definir
senha mínima, Site URL e redirects do domínio da loja incluindo `/reset-password`.
Definir `NEXT_PUBLIC_SITE_URL` do painel com o domínio novo. Configurar SMTP/serviço de
e-mail para convites e recuperação; as chaves ficam no ambiente de servidor.

Configurar painel e API com a mesma URL/chaves do novo Supabase, com service_role
somente no servidor. Refazer OAuth/webhooks Nuvemshop, credenciais Meta e conexão
WhatsApp. Não copiar stores, tokens, sessões ou usuários da origem.
Preencher regras comerciais e todos os textos em Configurações do painel, no
registro store_key = default, antes de ligar WhatsApp/webhooks/automações.
As chaves encontradas estão inventariadas sem valores; não há seed de regras da Moda Pink.

**Limite de escopo:** esta entrega trata do banco. O código ainda tem marca,
remetentes de e-mail, links e fallbacks comerciais da Moda Pink (por exemplo,
`lib/store-settings.ts` e `whatsapp-api/src/config/business-rules.ts`). Campos vazios
na API podem retornar esses fallbacks. A neutralização dos valores, telas e textos
deve preceder a ativação de outra loja. Salvar o SQL não conclui a neutralização do
sistema inteiro.

## Verificação reproduzível

```bash
npm ci --prefix tests/database --ignore-scripts
npm test --prefix tests/database
```

Verificado em PostgreSQL **17.5** do PGlite 0.3.16 (origem: 17.6): **19 testes passaram**.
Eles executam o SQL, comparam o catálogo e grants, verificam instalação vazia, FKs
Auth, bloqueio de banco existente, chat, configurações, autopromoção, mídia e RLS
automático. O bootstrap admin usa respostas HTTP simuladas, incluindo rollback.

Os schemas da plataforma são fixtures mínimas, e não um Supabase hospedado.
**Falta validar instalação e login num Supabase novo**, com Auth, Storage, Realtime
e integrações reais. Não foi criada conta nem alterada estrutura/dado de produção.

## Capturas futuras

`catalog.sql` consulta a estrutura pela integração/SQL Editor. Para dump adicional,
use psql/pg_dump compatíveis com o servidor e ambiente libpq (`PGHOST`, `PGPORT`,
`PGUSER`, `PGDATABASE`, `.pgpass`/`PGPASSWORD`):

```bash
node scripts/database/export-schema.mjs
```

O script faz leituras, salva capturas ignoradas pelo Git e as marca como ainda não
verificadas por restauração. Catalogação/dump são leituras separadas: não alterar
estrutura durante a captura. Revisar literais de funções/defaults/comentários antes
de versionar. Capturas novas não substituem as migrations automaticamente.
Rever buckets, policies, event triggers e personalizações gerenciadas separadamente;
o dump não exporta configuração Auth, secrets, arquivos Storage, Edge Functions ou cron.

Referências: [Backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[Auth createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[Criar buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets),
[Configuração local](https://supabase.com/docs/guides/local-development/cli/config).

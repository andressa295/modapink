# Arquitetura

## Cliente

`lib/supabase-client.ts` mantém o cliente por navegador, com PKCE e chave publicável. `SupabaseConfiguration` recebe apenas configuração pública do layout, permitindo valores de runtime na hospedagem. `lib/auth-context.tsx` verifica a identidade via `getUser()` e o perfil autorizado via RPC.

`lib/demo-store.tsx` preserva o nome do adaptador original, mas não usa mais exemplos nem gravações locais de estoque. Ele lê o estado validado por `lib/production-contract.ts`, executa comandos autenticados, preserva recibos de tentativa e resolve URLs temporárias para fotos privadas. O navegador mantém a sessão Auth; os registros operacionais pertencem ao banco.

`lib/domain.ts` contém tipos e cálculos. As mutações da operação são aplicadas no PostgreSQL, não por substituição de um JSON enviado pelo navegador. Os helpers antigos e `seed.ts` servem exclusivamente aos testes de domínio e não inicializam a aplicação operacional.

## Banco

`supabase/schema.sql` cria entidades normalizadas, bloqueio de revisão, recibos idempotentes, eventos de auditoria e regras de qualidade. Todas as tabelas têm RLS. APIs públicas são wrappers invoker para funções privadas com verificação explícita de perfil ativo e permissões de cada comando.

O schema `mf_private` deve ficar fora dos schemas expostos pela Data API. O cliente não pode editar saldos, perfis ou quantidades finais diretamente. Uma ordem captura o consumo e os custos de sua ficha para preservar o histórico.

## Dados e imagens

As imagens são gravadas em `confeccao-images`, privado. O banco persiste somente o caminho; links assinados são gerados na leitura. Como upload e comando SQL são operações de serviços distintos, um upload bem-sucedido seguido de falha no cadastro pode deixar um objeto órfão; manutenção futura deve remover somente objetos comprovadamente não referenciados, sem apagar imagens por tentativa ambígua de rede.

Custos não são enviados a produção/qualidade; a interface também oculta esses controles. Revogação de perfil é consultada no banco em cada operação, independentemente da validade do JWT.

## Vercel, banco aplicado e validação autenticada pendente

O projeto `ragyjbrbhfataoiosgqy`, da organização Confeccção Moda Pink, recebeu a estrutura operacional e o bucket privado. Foi restringido o EXECUTE público do helper de event trigger da plataforma, preservando sua função interna. As leituras e escritas operacionais exigem identidade autenticada com perfil ativo.

O endereço oficial é `https://modapink-confeccao.vercel.app`, no projeto Vercel `prj_BoPkAUvTQJs5bBo1aA0DGVbWnzrW`, equipe `team_eGmQjmQ95Bd8nTTnOwOy2Rxj`. A publicação de produção `dpl_9uKeKmJYuzxv8tK3PzxVBSQPFiLN`, commit `bb68beb370c6c7592469b0a4b9df6cf1796bfe79`, está READY. O Site anterior no ChatGPT foi excluído; o código permanece no GitHub.

O Auth foi configurado no painel Supabase com Site URL `https://modapink-confeccao.vercel.app` e redirects exatos `https://modapink-confeccao.vercel.app/auth/recovery` e `https://modapink-confeccao.vercel.app/auth/confirm`. O callback antigo do ChatGPT foi retirado da lista autorizada. O cadastro público permanece desligado; o endpoint `/auth/v1/settings` confirmou `disable_signup: true` e `external.email: true`. O callback de convite está implementado no aplicativo; a confirmação do e-mail e a definição da senha foram verificadas no Auth.

O SMTP personalizado Resend está habilitado com `smtp.resend.com`, porta `465`, e nome de remetente “Confecção Moda Pink”; a persistência da configuração foi conferida após recarregar o painel. Há uma identidade Auth criada por convite, com e-mail confirmado e senha pessoal definida, e um perfil administrador ativo. O convite foi enviado, e o envio ocorreu em `2026-10-31T23:46:57.288Z`, com status `delivered` confirmado pelo Resend. O template do Supabase está em português, usa `{{ .ConfirmationURL }}` e tem cópia em `supabase/email-templates/invite.html`. O endereço da destinatária, o UUID Auth e as credenciais SMTP não são gravados no repositório.

O bootstrap administrativo foi executado por operador, com bloqueio da fábrica, rejeição caso já existisse administrador ativo e exigência de e-mail confirmado e senha definida. O resultado foi verificado: papel `admin`, perfil ativo e exatamente um administrador ativo. A revisão da fábrica foi incrementada. Não repetir o bootstrap.

A única pendência é testar o fluxo completo da aplicação no navegador com sessão autenticada, incluindo login, recuperação, permissões e imagens privadas. Identidades sem perfil ativo continuam sem acesso aos dados. TypeScript, build, 22 testes de domínio/callback/portal e testes SQL com validação do envelope RPC passaram. Next.js 16.4.3 e Zod 4.6.7 corrigem os advisories encontrados; npm audit não retornou vulnerabilidades. O login publicado carregou corretamente e o painel sem sessão retornou ao login. Isso não substitui o teste autenticado com a conta real.


## Portal de confecções parceiras

A migração `20261101000759_create_partner_production_portal` está aplicada. Adiciona cinco tabelas privadas: `partners`, `partner_assignments`, `portal_links`, `portal_uploads` e `partner_updates`. A aplicação tem 16 tabelas; a seleção padrão `public` no editor mostra apenas `profiles`. As demais ficam em `mf_private`, com RLS e sem acesso direto de clientes.

Administração e gestão cadastram parceiras, atribuem ordens e geram ou revogam o link. Cada confecção recebe uma capacidade aleatória de aproximadamente 244 bits, válida por 30 dias. O banco guarda apenas SHA-256; o link completo aparece somente na criação e usa fragmento de URL. O portal usa cliente anônimo isolado da sessão do painel. Toda chamada e leitura de imagem revalida a capacidade, a situação da confecção e a atribuição atual.

As projeções externas não incluem custos, fornecedores ou dados das demais parceiras. Os apontamentos são imutáveis e idempotentes; quantidades são acumuladas, limitadas pela OP e acompanhadas do responsável, etapa e descrição obrigatória para defeitos. A indicação de retirada exige todas as peças produzidas e conferidas. Nenhum apontamento externo movimenta estoque, concede aprovação de qualidade ou conclui a OP. O painel consulta o andamento a cada 15 segundos enquanto visível.

Fotos opcionais usam reservas temporárias e o mesmo bucket privado. O cabeçalho de capacidade é validado por operação; download direto é permitido para fotos autorizadas, enquanto listagem e assinatura externas são negadas. Evidências anexadas não podem ser removidas pela parceira. Objetos órfãos podem exigir limpeza posterior comprovando ausência de referência.

Validação: build/TypeScript, 22 testes da aplicação e suites PostgreSQL local do núcleo e portal passaram. No serviço real, RPC interno sem sessão e capacidade inválida retornaram HTTP 401; preflight Storage aceitou o cabeçalho do portal. A gravação e leitura de foto com uma OP real ainda aguardam validação operacional. Não foram criadas parceiras, links ou ordens fictícias na produção.

O portal foi publicado na Vercel com a mesma versão do núcleo. `/portal-confeccao` respondeu HTTP 200, usa o projeto Supabase correto e recusou link ausente/inexistente no navegador; `/confeccoes` sem sessão redirecionou para `/login`. Login e portal não apresentaram erro de renderização no smoke HTTP. O fluxo positivo de apontamento com foto ainda exige uma OP real atribuída.

## Convites da equipe e interface simplificada

A migração `20261101002614_enable_admin_team_invitations` adiciona `mf_private.team_invite_requests`; agora são 17 tabelas da aplicação. `mf_team_list` retorna e-mail e situação somente a administração e gestão. `mf_team_prepare`, `mf_team_finish` e `mf_team_fail` são exclusivos de `service_role`, por wrappers invoker e implementações privadas com autorização explícita da administração ativa, inclusive depois de esperar o bloqueio da fábrica. O editor de perfil também revalida a autorização após esse bloqueio.

A Edge Function `team-access`, versão 1, está ativa e exige JWT no gateway. O handler ainda verifica a identidade no Auth; somente então chama os RPCs de servidor. Credenciais são injetadas pelo runtime Supabase, nunca enviadas à Vercel ou ao navegador. Chamadas REST não precisam de pacote externo. Os destinos de convite e recuperação são fixos na Vercel; não recebem URL de redirecionamento do cliente. Nenhum link, senha ou segredo retorna ao administrador.

Cada solicitação congela ator, destinatário e papel. O banco autoriza o envio uma vez, limita 20 solicitações/hora por administrador e mantém 60 segundos por destinatário. Finalização confere identidade/e-mail e insere somente perfil ausente; não reativa, renomeia nem promove perfil já existente. Ambiguidade de rede fica marcada para retomada sem reenvio automático. O e-mail vai pelo SMTP já configurado; o template de recuperação foi salvo em português no Supabase e no repositório.

Atribuir produção ganhou ação direta **Vincular produção** no cartão da confecção, guia de três passos e explicação para link ainda sem lote. O portal ganhou botões de etapa com descrição, orientações e exemplo de totais acumulados. A dashboard mostra etapa e próximo passo por lote; o detalhe explica a próxima ação e preserva o bloqueio de conclusão por qualidade. O login apresenta o logo grande acima das três áreas, com Poppins aplicada também a controles e tabelas.

Validação local: 30 testes de aplicação/handler/adaptador REST, TypeScript do frontend e da Edge, build e suites PostgreSQL de núcleo/portal/equipe passaram. Não foram enviados convites reais de teste. O percurso positivo com destinatário real continua pendente; o convite administrativo entregue anteriormente é uma verificação separada.

Publicação final da interface simplificada confirmada READY. O login foi conferido no navegador, com logo em destaque, etapas preservadas e texto anterior removido; referência visual em `docs/login-marca.jpg`. Rotas públicas responderam HTTP 200 sem erro de servidor. O gateway da Edge negou ausência de sessão (401), e o próprio handler negou JWT anônimo (401), com CORS restrito à origem oficial (204). Os RPCs de servidor não têm EXECUTE para anon/authenticated. Nenhum erro/fatal apareceu no recorte de logs consultado. O template de recuperação persistiu após recarregar o Supabase.

Envios incertos podem ser retomados pelo mesmo ID ou encerrados explicitamente após aviso e consulta da equipe. Encerrar limpa somente o estado do formulário; não envia e-mail nem altera o cadastro no servidor. O último ajuste passou novamente por TypeScript e build.

## Metadados privados e exclusão segura

A migração `20261101003900_fix_portal_private_image_metadata` acrescenta `storage.object.get_authenticated_info` à mesma política restrita de leitura por capacidade. O erro relatado foi diagnosticado em logs: RPC do portal com sucesso e consulta de metadados da foto bloqueada. Uma verificação no banco real, com todas as alterações da prova revertidas, confirmou leitura de metadados/download da foto atribuída e negação de listagem/assinatura. Nenhum link foi rotacionado pelo teste. O cliente preserva status HTTP; falha de mídia revalida o RPC e só mantém dados ainda autorizados, com aviso e recarga de fotos.

`20261101004440_enable_safe_record_removal` adiciona arquivo por data/ator a materiais, modelos, ordens, parceiras e perfis. O RPC invoker `mf_remove_record(text,text)` chama implementação privada, verifica administração/gestão depois do bloqueio da fábrica e restringe membros à administração. A operação é idempotente. A exclusão de OP libera reserva com movimento auditável; não reverte consumo físico. Parceiras têm links revogados; membros ficam inativos, sem remoção destrutiva de Auth. A própria conta e o último administrador são protegidos.

GETs, métricas, consultas do portal e regras de imagem filtram os removidos. Materiais/modelos referenciados por OP visível seguem como dependências marcadas `archived`, ocultas no catálogo e nos seletores; o servidor proíbe novos usos. Índices de identificação únicos passam a considerar somente registros ativos para permitir recadastro. Convites de readição congelam o instante de remoção; somente uma nova intenção explícita e ainda válida pode restaurar o perfil. Tickets antigos ou de uma remoção anterior não servem. A Edge versão 2 trata essas retomadas sem reenviar mensagem automaticamente.

Verificação: 52 testes de aplicação, TypeScript, build e cinco suítes PostgreSQL passaram. No projeto real, a projeção operacional e o perfil administrativo permaneceram válidos, RPC de exclusão não foi liberado a anônimos e a migração não removeu nenhum registro existente. Nenhum cadastro real foi excluído para provar a interface.

A versão com exclusões e correção do portal foi confirmada READY na Vercel. O login foi conferido no navegador e contém exatamente uma imagem de logo Moda Pink, em destaque. A imagem em `docs/login-marca.jpg` foi atualizada. A chamada anônima real de `mf_remove_record` respondeu HTTP 401/42501. As validações autenticadas de remoção usam o PostgreSQL local; nenhum cadastro da cliente foi excluído para teste.

## Refinamento operacional e e-mails

Alteração de interface sem migração: menu na sequência material → ficha → OP → parceira → qualidade → custos; lixeiras compactas com aria-label/title e confirmações preservadas. Custos mantém snapshots e autorização, sincroniza filtro/busca/exportação, distingue previsão de tecido apurado mais tarifas da ficha e apresenta aproveitamento apenas dos concluídos. A área pink não tem círculos decorativos nem o slogan anterior.

A qualidade mantém um único `inspect_order` por envio, com resultado e quantidades explícitos, motivo/foto/notas, resumo do efeito nos contadores e verificação de alterações do lote durante a revisão. O mesmo payload é preservado em tentativas sem confirmação. Foto preparada após troca de lote não é anexada a outro lote. Quatro testes novos verificam quantidades e revisão.

Os dois modelos de e-mail foram salvos pela interface do Supabase; usam a mesma variável `{{ .ConfirmationURL }}` e o logo PNG absoluto já disponível na Vercel. O arquivo público respondeu HTTP 200/image/png. Não foram criadas contas ou disparados e-mails reais para validar a aparência. A checagem automática de aplicação soma 56 testes, além de TypeScript e build.

O refinamento foi publicado READY na Vercel no deployment `dpl_8MknBzeE59p9nTULyRcfZXHJGncB`, código `d4221245c44a17b87a8616408521a32a3ba1e5a9`. Login, dashboard, portal e PNG público responderam HTTP 200; não surgiram entradas error/fatal nos logs consultados. O login público foi recarregado no navegador. O percurso visual autenticado completo desta interface permanece pendente, sem criar ou excluir registros reais para testes.

Na prévia sandbox do Supabase, o corpo e CTA foram conferidos e a persistência verificada após recarga; o logo não carregou naquele contexto (causa não determinada). A mesma URL absoluta abriu a imagem diretamente no navegador e respondeu PNG público válido. A captura `docs/email-modelo-salvo.jpg` mostra o corpo do convite salvo, não um e-mail entregue. Não foi afirmada renderização em Gmail/Outlook ou envio real do novo design.

## Formação de preço e simulações persistentes

`mf_private.pricing_sheets` armazena documento versionado, revisão otimista, autor da criação/alteração e exclusão lógica. RLS é defesa adicional; não há SELECT/INSERT/UPDATE/DELETE para clientes. `public.mf_pricing_list/save/remove` são invoker, sem EXECUTE para anon; funções privadas definer com search_path vazio revalidam perfis ativos e não arquivados de administração/gestão. O validador privado não é executável por clientes. A escrita bloqueia a linha do perfil e usa advisory lock transacional por UUID, compara revisão e permite repetição do mesmo documento sem nova linha/revisão. Um registro arquivado não pode ser ressuscitado. A migração aplicada no projeto dedicado é `20261101020350_create_pricing_sheets`. Nenhuma tabela ou RPC operacional anterior foi alterada.

A simulação contém uma cópia independente dos valores importados, sem sincronização implícita com fichas/OPs. Custos por peça multiplicam a quantidade produzida; custos de lote entram uma vez; despesas mensais dividem pelo volume mensal vendável e são alocadas às vendáveis do lote. O total divide pelas peças vendáveis. As taxas percentuais entram no denominador de formação de preço, sem mistura com valores monetários. Margem é sobre a venda, não markup. Arredondamento dos preços calculados é para cima ao centavo. Atacado praticado pode substituir o calculado na revenda; resultado negativo é destacado. Impostos, taxas e margens começam em zero e exigem premissas da operação.

Validação: 64 testes de aplicação e seis suítes PostgreSQL locais passaram, incluindo casos de perda, rateio, taxas, margem, preço insuficiente, revenda, entradas brasileiras, CRUD, replay, conflito de revisão, exclusão, permissões e validação de payload. TypeScript e build passaram. No banco real, um teste transacional criou/listou/repetiu/excluiu uma simulação sintética e foi totalmente revertido: zero simulações permanentes. As ACLs e RLS foram confirmadas. O advisor mantém apenas os INFO esperados das tabelas privadas e o aviso pré-existente de proteção contra senhas vazadas; nenhuma política de acesso direto foi aberta. O percurso visual com sessão real permanece pendente.

Publicação da formação de preço: Vercel READY, código `c9841a2fe818e8fe8d182baa4fba91292f1944b4`, deployment `dpl_9RQQuGP88J3wD2GGvAurtVLCSNdB`. A rota respondeu HTTP 200 e, no navegador sem sessão, redirecionou corretamente ao login. Não houve entradas error/fatal nos logs consultados. O percurso autenticado da interface não foi executado neste navegador.

## Assinatura visual Phand

Os créditos existentes no login, definição de senha, painel e portal usam `AgencyCredit`, com link HTTPS do portfólio em nova aba e rel noopener/noreferrer. O PNG é uma cópia exata de `andressa295/phandportfolio/public/logophand.png` (blob `79d7b5cedee7f2036ade528268cca47b65fcd73c`), conferida contra o arquivo público do portfólio. A marca permanece rosa nos fundos claros; o componente usa filtro CSS branco nos fundos escuros. O desenho não foi refeito em fonte ou alterado. Os dois templates de e-mail usam o mesmo PNG rosa em URL absoluta da aplicação; ConfirmationURL permanece uma vez por template. Não houve alteração no banco, Auth, destinatários ou disparo de mensagens. O build com TypeScript passou.

Publicação da assinatura: Vercel READY, código `8fb9ba4e50142c64d45de9d6405c6940067c8269`, deployment `dpl_Eg3dZTbq2CbrKMx4trkfLCfGvxH7`. A URL pública do PNG respondeu 200 e preservou o blob original. No navegador, o login carregou a imagem com brightness(0)/invert(1), e o portal claro carregou sem filtro; ambos apontam para o portfólio correto. A captura do login foi atualizada em `docs/login-marca.jpg`. Os dois modelos foram salvos no Supabase com confirmação de sucesso e link Phand na prévia. Não foram enviados novos e-mails reais.

## Refinamento para celular e iPhone

`components/mobile.css` aplica o piso de16px a input/select/textarea, com especificidade e important suficientes para vencer controles compactos das rotas; a condição inclui max-width820 e ponteiro coarse, cobrindo iPhone em paisagem. Contadores usam variável própria para preservar26px. O viewport mantém o zoom por gesto e declara viewport-fit cover; env safe-area protege cabeçalho, rodapés, menu e visualizador de fotos. Modais preservam o diálogo nativo, o cabeçalho sticky e o scroll interno. Áreas clicáveis têm mínimo44px, incluindo o botão real da ajuda.

A recuperação recebe grupos separados de nova senha e confirmação, espaçamento vertical24px e ação principal separada, sem mudar o tratamento de tokens ou de senha. Autocapitalização, autocorreção e spellcheck estão desativados em e-mail/senhas. As tabelas materiais/parceiras ganham data-labels e roles explícitos para manter semântica no Safari/VoiceOver quando viram cartões. Não houve migração, chamada de escrita no banco ou criação/envio de acesso.

Seis folhas de estilo passaram no parser PostCSS e a estrutura dos dois grupos de senha foi conferida. O preview oficial falhou nas flags de execução (Next não aceita --host/--strictPort); foi parado conforme as instruções da ferramenta. Não foi instalado outro navegador nem criado servidor alternativo. O navegador disponível permaneceu em1363px e não ofereceu emulação de aparelho; teste visual responsivo e Safari físico não foram declarados como concluídos.

Publicação mobile: READY na Vercel, código `dc2ffba7a0673185fc93d73e2560396ad9da9c36`, deployment `dpl_FxBX2R4eWjSSx3MaDsHyNvEX4LMY`. Build e TypeScript finais passaram. Recuperação de senha respondeu HTTP200; o viewport público mantém largura do dispositivo, escala inicial1 e áreas seguras, sem bloquear zoom manual. As folhas mobile foram entregues pela versão pública. Não houve entradas error/fatal nos logs consultados. As publicações anteriores concluíram normalmente; nenhum cancelamento foi executado. A validação visual móvel/iPhone permanece pendente.

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

O endereço oficial é `https://modapink-confeccao.vercel.app`, no projeto Vercel `prj_BoPkAUvTQJs5bBo1aA0DGVbWnzrW`, equipe `team_eGmQjmQ95Bd8nTTnOwOy2Rxj`. A publicação de produção `dpl_2JUm6nNuTw5kzc4uxThvCE3dnGMK`, commit `03b1fd5fb1004f6fcd1a8c67122de448d62435dd`, está READY. O Site anterior no ChatGPT foi excluído; o código permanece no GitHub.

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

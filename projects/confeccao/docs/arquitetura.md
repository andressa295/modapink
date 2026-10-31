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

O endereço oficial é `https://modapink-confeccao.vercel.app`, no projeto Vercel `prj_BoPkAUvTQJs5bBo1aA0DGVbWnzrW`, equipe `team_eGmQjmQ95Bd8nTTnOwOy2Rxj`. A publicação de produção `dpl_29ua1j39JPBmzbXVMqZH1uZeuFCR`, commit `e09e23d50a3f4ae6cbca83e83a12630b6edcf3d4`, está READY. O Site anterior no ChatGPT foi excluído; o código permanece no GitHub.

O Auth foi configurado no painel Supabase com Site URL `https://modapink-confeccao.vercel.app` e redirects exatos `https://modapink-confeccao.vercel.app/auth/recovery` e `https://modapink-confeccao.vercel.app/auth/confirm`. O callback antigo do ChatGPT foi retirado da lista autorizada. O cadastro público permanece desligado; o endpoint `/auth/v1/settings` confirmou `disable_signup: true` e `external.email: true`. O callback de convite está implementado no aplicativo; a confirmação do e-mail e a definição da senha foram verificadas no Auth.

O SMTP personalizado Resend está habilitado com `smtp.resend.com`, porta `465`, e nome de remetente “Confecção Moda Pink”; a persistência da configuração foi conferida após recarregar o painel. Há uma identidade Auth criada por convite, com e-mail confirmado e senha pessoal definida, e um perfil administrador ativo. O convite foi enviado, e o envio ocorreu em `2026-10-31T23:46:57.288Z`, com status `delivered` confirmado pelo Resend. O template do Supabase está em português, usa `{{ .ConfirmationURL }}` e tem cópia em `supabase/email-templates/invite.html`. O endereço da destinatária, o UUID Auth e as credenciais SMTP não são gravados no repositório.

O bootstrap administrativo foi executado por operador, com bloqueio da fábrica, rejeição caso já existisse administrador ativo e exigência de e-mail confirmado e senha definida. O resultado foi verificado: papel `admin`, perfil ativo e exatamente um administrador ativo. A revisão da fábrica foi incrementada. Não repetir o bootstrap.

A única pendência é testar o fluxo completo da aplicação no navegador com sessão autenticada, incluindo login, recuperação, permissões e imagens privadas. Identidades sem perfil ativo continuam sem acesso aos dados. TypeScript, build, 15 testes de domínio/callback e testes SQL com validação do envelope RPC passaram. Next.js 16.4.3 e Zod 4.6.7 corrigem os advisories encontrados; npm audit não retornou vulnerabilidades. O login publicado carregou corretamente e o painel sem sessão retornou ao login. Isso não substitui o teste autenticado com a conta real.


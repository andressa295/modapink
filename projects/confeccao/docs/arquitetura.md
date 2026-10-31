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

## Banco aplicado, Auth configurado e contas pendentes

O projeto `ragyjbrbhfataoiosgqy`, da organização Confeccção Moda Pink, recebeu a estrutura operacional e o bucket privado. Foi restringido o EXECUTE público do helper de event trigger da plataforma, preservando sua função interna. As leituras e escritas operacionais exigem identidade autenticada com perfil ativo.

O Auth foi configurado no painel Supabase com Site URL `https://modapink-confeccao.phandstudio.chatgpt.site` e redirect de recuperação exato `https://modapink-confeccao.phandstudio.chatgpt.site/auth/recovery`. O cadastro público foi desligado; o endpoint `/auth/v1/settings` confirmou `disable_signup: true` e `external.email: true`.

Ainda não existem contas Auth provisionadas: falta confirmar o e-mail da primeira administradora. O SMTP personalizado permanece desativado. É necessário configurar o envio de e-mail e verificar a entrega para um destinatário real, provisionar a primeira identidade/perfil autorizado e testar login, recuperação, permissões e imagens com essa conta. A configuração de Auth concluída não equivale à verificação do fluxo autenticado.


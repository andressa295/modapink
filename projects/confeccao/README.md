# Moda Pink · Gestão da Confecção

Aplicação independente em Next.js App Router, TypeScript e Tailwind CSS 4. Identidade Moda Pink: Poppins local, login escuro e dashboard clara com pink #e70289.

## Situação da integração

Endereço oficial: [https://modapink-confeccao.vercel.app](https://modapink-confeccao.vercel.app). A versão corrigida foi publicada em produção na Vercel. O Site anterior no ChatGPT foi excluído, e seus callbacks foram removidos do Supabase.

Banco instalado no projeto `ragyjbrbhfataoiosgqy` (Confeccção), organização Confeccção Moda Pink. Migrações aplicadas: estrutura operacional e restrição de execução de um helper privilegiado da plataforma. Todas as tabelas da aplicação usam RLS, e as imagens ficam no bucket privado `confeccao-images`.

A aplicação usa configuração pública do projeto na hospedagem, sem chaves administrativas no cliente. O Auth por e-mail/senha está configurado para a Vercel: Site URL `https://modapink-confeccao.vercel.app`, redirects exatos `https://modapink-confeccao.vercel.app/auth/recovery` e `https://modapink-confeccao.vercel.app/auth/confirm`, e cadastro público desativado. O callback antigo do ChatGPT foi removido da lista autorizada. O endpoint de configurações confirmou `disable_signup: true` e `external.email: true`.

O SMTP personalizado Resend está configurado e sua persistência foi confirmada após recarregar o painel. Há uma identidade Auth criada por convite, com e-mail confirmado e senha pessoal definida, e um perfil administrador ativo. O convite foi enviado e o convite foi enviado em `2026-10-31T23:46:57.288Z` e o Resend confirmou sua entrega. O e-mail da destinatária não é persistido neste repositório. O bootstrap administrativo já foi executado e verificado: há exatamente um administrador ativo. Não repetir o bootstrap. Resta validar o fluxo completo da aplicação com sessão autenticada, incluindo as imagens privadas. Nenhum usuário ou senha padrão foi inventado.

O template de convite do Supabase está em português, usa `{{ .ConfirmationURL }}` e tem sua cópia em [supabase/email-templates/invite.html](supabase/email-templates/invite.html). O assunto enviado foi “Crie sua senha — Confecção Moda Pink”. O recibo sem destinatário está em `supabase/deployment-status.json`.

![Referência visual da dashboard](docs/preview-dashboard.jpg)

## Execução

Requer Node.js 22.13 ou superior.

```sh
cd projects/confeccao
npm ci
cp .env.example .env.local
# Preencher a URL e a chave PUBLICÁVEL do projeto correto.
npm run dev
```

Configuração pública necessária:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Somente chaves `sb_publishable_...` são aceitas no cliente. Nunca usar chave administrativa no frontend. Sem configuração válida, o aplicativo informa que a conexão está pendente e não abre dados demonstrativos como se fossem reais.

## Funcionalidades preparadas

- Login por e-mail/senha, encerramento de sessão e recuperação de senha com destino fixo.
- Callback de convite em `/auth/confirm` implementado; convite entregue, e-mail confirmado e primeira senha definida, com estados verificados no Auth.
- Perfis ativos: administração, gestão, produção e qualidade, com autorização efetiva no banco.
- Materiais e fichas por lote, reservas e consumo real em comandos transacionais.
- Ordens em lista ou quadro, quantidades por tamanho e bloqueio de conclusão sem qualidade.
- Aprovação, retrabalho, reconferência e perdas sem dupla contagem.
- Custos históricos por snapshots imutáveis e acesso financeiro restrito.
- Dashboard com aprovações por data registradas no banco, sem distribuição fictícia.
- Imagens em bucket privado, com URLs temporárias na leitura e limite de 5 MB.
- Controle de revisão e chaves idempotentes para impedir duplicidades em tentativas repetidas.
- Estados de fábrica vazia; nenhum exemplo é importado automaticamente para produção.

## Verificação local

```sh
npm run typecheck
npm test
npm --prefix supabase/tests ci
npm run test:db
npm run build
```

TypeScript, build, 15 testes locais de domínio/callback e os testes PostgreSQL passaram. Next.js 16.4.3 e Zod 4.6.7 estão fixados; a auditoria npm não encontrou vulnerabilidades em produção ou desenvolvimento. A publicação Vercel está READY e o login respondeu HTTP 200 com a configuração pública do Supabase correto. O painel redireciona visitantes sem sessão ao login. A confirmação do e-mail, a definição da senha e o perfil administrador ativo foram verificados no banco; o teste completo no navegador com sessão autenticada e upload/leitura privada permanece pendente.

Os testes SQL usam PostgreSQL embarcado com Auth/Storage sintéticos, sem conexão à operação da cliente. Verificam atomicidade, reservas, concorrência, replay, qualidade, snapshots, contrato de retorno, RLS e permissões. Não substituem os testes reais de Auth, entrega de e-mail e upload/download após liberar o projeto.

## Ativação no projeto correto

Consulte [supabase/README.md](supabase/README.md) para os registros da instalação e a validação restante. O banco já foi aplicado; não executar `schema.sql` novamente sobre a estrutura existente. O bootstrap da primeira administradora já foi concluído e não deve ser repetido. O cadastro público já está desativado e deve permanecer assim. As contas serão individuais, com e-mails fornecidos e confirmados pela responsável. O bootstrap não promove o primeiro visitante nem cria senhas padrão.

As configurações da interface administram perfis já provisionados. A criação de identidades Auth e os convites exigem o fluxo administrativo verificado no Supabase. Os nomes dos perfis de permissão não são logins compartilhados.

A pasta mantém build e dependências próprios; o TypeScript da raiz a exclui do painel existente.

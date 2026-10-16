# Recuperação do painel WhatsApp e campanhas

## Escopo e limites

Este ajuste pertence somente ao painel `andressa295/modapink`. A API já respondeu
`GET /sessions` com cinco sessões no diagnóstico fornecido. Não reinicie a API,
não apague sessões e não leia novos QR codes para corrigir a configuração do painel.
Não inicie campanhas como teste.

O proxy agora rejeita URL/chave inválida com HTTP 503 e uma mensagem segura.
Isso **não corrige automaticamente** uma chave incorreta já armazenada no PM2.
A tela de campanhas passa pelo mesmo domínio do painel, preservando o Bearer do
usuário; a API continua validando sua identidade e seu perfil de administrador.
A chave interna nunca é enviada pelo proxy de campanhas, pois a API a trata como
um bypass de administrador.

## Causa provável da configuração inválida

O comando anterior capturava a saída de `dotenv.config()` junto com a chave.
Versões que imprimem `[dotenv] ...` podem contaminar a variável com uma linha de
log. A verificação de “variável presente” do PM2 não detecta isso. A saída fornecida
não confirma que o comando posterior com `quiet: true` tenha sido concluído.
A hipótese precisa ser confirmada no ambiente; não há acesso de produção neste PR.

O comando anterior exportou a variável e executou `pm2 restart painel --update-env`;
não há evidência de alteração do `.env` do painel. Não sobrescreva esse arquivo.

## Verificação sem revelar credenciais

Execute no servidor, somente se tiver autorização, sem gravar a saída completa de
`pm2 env`, `pm2 jlist`, arquivos `.env` ou cabeçalhos em logs/conversas. Este comando
mostra somente se a configuração do processo `painel` é válida:

```sh
node <<'NODE'
const { execFileSync } = require('node:child_process')
try {
  const list = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  const panel = list.find(p => p.name === 'painel')
  if (!panel) throw new Error('missing process')
  const env = panel.pm2_env || {}
  const value = env.WHATSAPP_API_INTERNAL_URL ?? env.WHATSAPP_API_URL ?? 'http://127.0.0.1:3001'
  const key = env.WHATSAPP_API_INTERNAL_KEY ?? env.INTERNAL_API_KEY
  let validUrl = false
  try {
    const url = new URL(value)
    validUrl = /^https?:\/\//i.test(value) && !/[\s\\\u0000-\u001f\u007f]/.test(value) &&
      /^https?:$/.test(url.protocol) && !!url.hostname &&
      !url.username && !url.password && !url.search && !url.hash
  } catch {}
  console.log(JSON.stringify({
    processo: panel.name,
    urlValida: validUrl,
    chavePresente: typeof key === 'string' && key.length > 0,
    formatoDaChaveValido: typeof key === 'string' && /^[\x21-\x7e]+$/.test(key)
  }, null, 2))
} catch {
  console.error('Não foi possível validar a configuração do painel. Nenhuma credencial foi exibida.')
  process.exitCode = 1
}
NODE
```

Uma chave com formato válido ainda pode ser diferente da chave da API. O passo
seguinte valida a chave do arquivo da API contra uma leitura de `/sessions`
antes de alterar o ambiente do painel.

## Reparar somente a variável runtime do painel

Ação manual separada, após autorização para atualizar a configuração e reiniciar
**apenas `painel`**. O processo foi identificado em `/root/modapink`; o `.env` da API
em `/root/whatsapp-api`. Se os caminhos/processos mudaram, confirme-os primeiro.

O bloco abaixo usa `dotenv.parse`, que não imprime logs nem muda a chave da API.
Ele só copia a chave existente para o ambiente do painel depois de um `GET`
autenticado e bem-sucedido. Não mostra a chave no terminal e não altera arquivos `.env`. O PM2 recebe a chave
no ambiente do processo; o salvamento persistente é explicado separadamente abaixo.
Execute o bloco inteiro em Bash, sem `set -x`. Se houver falha, pare e investigue;
não substitua por uma chave vazia nem remova a autenticação.

```sh
set +x
PANEL_INTERNAL_KEY="$(
  cd /root/whatsapp-api && node <<'NODE'
const fs = require('node:fs')
const dotenv = require('dotenv')
;(async () => {
  const key = dotenv.parse(fs.readFileSync('.env')).INTERNAL_API_KEY
  if (!key || !/^[\x21-\x7e]+$/.test(key)) throw new Error('invalid key')
  const response = await fetch('http://127.0.0.1:3001/sessions', {
    headers: { Accept: 'application/json', 'x-internal-api-key': key },
    redirect: 'manual',
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok || !Array.isArray(await response.json())) throw new Error('API validation failed')
  process.stdout.write(key)
})().catch(() => {
  console.error('A chave não pôde ser validada por leitura na API. O painel não foi alterado.')
  process.exitCode = 1
})
NODE
)" &&
export WHATSAPP_API_INTERNAL_URL='http://127.0.0.1:3001' &&
export WHATSAPP_API_INTERNAL_KEY="$PANEL_INTERNAL_KEY" &&
pm2 restart painel --update-env
unset PANEL_INTERNAL_KEY WHATSAPP_API_INTERNAL_KEY WHATSAPP_API_INTERNAL_URL
```

Reexecute a verificação segura anterior. Se quiser manter a configuração após
reboot, `pm2 save` grava o estado de **todos** os processos e suas variáveis,
incluindo credenciais, no arquivo de dump do PM2. Faça isso somente com autorização
para esse salvamento; não compartilhe nem publique esse arquivo. Não execute `pm2 restart all`, nem
`pm2 restart whatsapp-api`. Um futuro deploy/restart da API exige primeiro o
procedimento de migração dos marcadores de sessões prontas do PR 98 da API;
esse procedimento está fora deste ajuste do painel.

## Publicar o código do painel e verificar

Este PR é um rascunho. Revisar e autorizar merge/deploy separadamente. Depois de
aprovar o commit, usar o procedimento existente de deploy do painel, em
`/root/modapink`, preservando os arquivos de ambiente. Antes de reiniciar:

```sh
node --test tests/*.cjs
npx tsc --noEmit
npm run build
```

Só reinicie `painel` se o build terminar com sucesso. Se já corrigiu o ambiente
runtime acima, um restart normal de `painel` preserva suas variáveis PM2; não use
`--update-env` com valores antigos ou contaminados. Não troque o build ativo por
um build com falhas. O processo da API deve permanecer em execução.

No navegador, autenticado como administrador:

1. Abra Conexões. Em Network, `GET /api/whatsapp/runtime/sessions` deve retornar
   HTTP 200 e um array. Compare as sessões com a leitura local da API. Não apague
   sessões nem inicie pareamento durante a verificação.
2. Abra Campanhas. As leituras `/api/whatsapp/broadcasts` e
   `/api/whatsapp/broadcasts/sessions` devem retornar HTTP 200. A contagem de
   contatos e as carteiras devem carregar. Não clique em Iniciar/Retomar.
3. Se houver erro, registre somente horário, caminho, status HTTP e a mensagem
   sem dados pessoais. Não compartilhe Bearer, chave, cookies, HAR completo ou
   listas de destinatários. HTTP 401/403 indica autenticação/perfil; 503 de
   configuração indica variável inválida; 502 indica falha de comunicação ou
   resposta inválida; 504 indica timeout. Erros JSON da API mantêm status e
   mensagem, inclusive falhas de sessão ou migração.
4. Em timeout de uma alteração, confirme o estado atual antes de tentar novamente.
   O proxy não repete alterações automaticamente e não segue redirects.

Se as campanhas ainda falharem, a mensagem exata determina o próximo diagnóstico.
A mudança de transporte não comprova que toda falha de campanha esteja resolvida.
Não altere a fila, as proteções de destinatários ou o banco sem identificar a causa.

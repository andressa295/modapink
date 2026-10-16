# Recuperação do painel WhatsApp e campanhas

## Diagnóstico confirmado e escopo

Em 16/10/2026, o diagnóstico no VPS confirmou:

- `/root/whatsapp-api/.env` e o shell não contêm `INTERNAL_API_KEY`.
- `GET http://127.0.0.1:3001/sessions`, **sem chave**, respondeu HTTP 200 com um array de cinco sessões.
- O código atual da API permite `/sessions` sem chave quando `INTERNAL_API_KEY` está ausente. Quando há uma chave, o Bearer dessa rota é comparado à chave interna; não é a autenticação de usuário Supabase usada por `/broadcasts`.

A API está funcionando no modo existente sem chave. Não invente uma chave, não
altere seu `.env`, não reinicie a API e não gere novos QR codes para esta correção.
O procedimento anterior do painel parou na validação prévia, antes de buscar o
commit ou reiniciar processos. A saída de `dotenv.config()` provavelmente foi
capturada como uma suposta chave, embora a variável real estivesse ausente.

Este PR corrige somente o painel. Preserva esse modo existente **apenas para URLs
com os endereços literais `127.0.0.1` ou `[::1]` e protocolo HTTP/HTTPS**. Não aceita
`localhost`, DNS, IP remoto, formas abreviadas/numéricas alternativas de loopback,
redirecionamento ou fallback para `NEXT_PUBLIC_API_URL` como acesso sem chave.
URLs/chaves explicitamente malformadas continuam retornando HTTP 503 sanitizado.
Chaves válidas continuam sendo encaminhadas normalmente. Sem chave em URL remota,
o proxy recusa a requisição. Uma resposta 401 da API permanece 401: não há tentativa
automática de retirar uma chave e repetir a operação.

O proxy de sessões continua exigindo administrador autenticado no painel, origem
permitida, métodos/caminhos restritos e corpo limitado. O proxy de campanhas
continua encaminhando exclusivamente o Bearer do usuário, sem chave interna ou
cookies; a API valida esse usuário e seu perfil. Nenhuma campanha deve ser iniciada
como teste de implantação.

## Verificação local segura, somente leitura

O bloco abaixo não imprime chaves, cookies, telefones ou respostas completas:

```sh
node <<'NODE'
;(async () => {
  try {
    const r = await fetch('http://127.0.0.1:3001/sessions', {
      redirect: 'manual', signal: AbortSignal.timeout(15000)
    })
    const text = await r.text()
    let data; try { data = JSON.parse(text) } catch {}
    console.log(JSON.stringify({
      http: r.status,
      lista: Array.isArray(data),
      quantidade: Array.isArray(data) ? data.length : null
    }))
  } catch (error) {
    console.log(JSON.stringify({ erro:
      ['TimeoutError', 'AbortError'].includes(error?.name) ? 'timeout' : 'falha_de_rede' }))
  }
})()
NODE
```

Se retornar 401, falhar ou mudar de formato, pare e investigue antes de modificar o
painel. Não retire uma proteção da API para fazer o teste passar.

## Corrigir somente o ambiente do painel

Depois de instalar e compilar o commit revisado deste PR, a configuração do modo
confirmado é aplicada **somente ao processo PM2 `painel`**, em `/root/modapink`:

```sh
WHATSAPP_API_INTERNAL_URL='http://127.0.0.1:3001' \
WHATSAPP_API_INTERNAL_KEY='' \
INTERNAL_API_KEY='' \
pm2 restart painel --update-env
```

Os valores vazios removem do ambiente efetivo do painel as duas possíveis fontes
de chave contaminada. Não edite arquivos `.env` nem as variáveis/processos da API.
Não execute `pm2 restart all` ou `pm2 restart whatsapp-api`.

Confira apenas a presença dos valores, nunca imprima `pm2 env`, `pm2 jlist` bruto
ou o conteúdo dos arquivos de ambiente em conversas. O script de publicação deve
confirmar que ambas as variáveis de chave do processo `painel` estão vazias e a URL
é a esperada, sem exibir qualquer valor de credencial.

O restart acima não salva o estado do PM2 em disco. Se precisar persistir após
reboot, `pm2 save` grava o estado de **todos** os processos e suas variáveis,
incluindo credenciais, no dump do PM2. Isso é uma ação separada a autorizar; não
publique nem compartilhe esse arquivo.

## Publicação e validação

Este PR é um rascunho. Use somente o commit revisado/autorizado. Não suponha que
`git pull main` inclui a correção enquanto o PR não estiver integrado.

Antes de alterar a versão ativa, verifique o repositório e que não há alterações
locais. Guarde o commit anterior, `.next` e `node_modules` para rollback. Pare
**somente `painel`** durante a troca, instale dependências de desenvolvimento para
compilar, execute os testes e o build, e reinicie-o somente após sucesso. Se houver
falha, restaure os arquivos e commit anteriores. Não descarte alterações locais.

```sh
PUPPETEER_SKIP_DOWNLOAD=true npm ci --include=dev --no-audit --no-fund
node --test tests/*.cjs
npx --no-install tsc --noEmit
npm run build
```

Depois de reiniciar, confirme a prontidão do processo e abra o painel autenticado:

1. Em Conexões, `GET /api/whatsapp/runtime/sessions` deve retornar HTTP 200 e um
   array com as sessões. Não apague sessões nem inicie pareamento como teste.
2. Em Campanhas, as leituras `/api/whatsapp/broadcasts` e
   `/api/whatsapp/broadcasts/sessions` devem retornar HTTP 200. Verifique carteiras
   e contagens. Não clique em Iniciar/Retomar.
3. Se houver erro, compartilhe somente caminho, HTTP e mensagem sem dados pessoais.
   Não envie Bearer, chave, cookies, HAR completo ou listas de destinatários.
4. HTTP 401/403 indica autenticação/perfil; 503 local pode indicar configuração
   inválida; 502 indica comunicação/resposta inválida; 504 indica timeout. Erros
   JSON reais da API mantêm seu status e mensagem. Após timeout de uma alteração,
   confira o estado antes de tentar novamente. O proxy não repete mutações.

O erro original exato das campanhas não foi fornecido. A mudança de transporte
não comprova que toda falha de campanha esteja resolvida; a validação autenticada
em produção continua necessária.

## Segurança da API: observação separada

O código atual da API libera `/sessions` quando não há chave; essa exceção não é
restrita a loopback no próprio serviço. O diagnóstico local não informa se a porta
está exposta externamente. Este ajuste **não muda** listener, firewall, Nginx ou
segurança da API. Uma revisão dessa exposição é separada e não deve causar restart
ou indisponibilidade do WhatsApp durante a correção do painel. Um futuro restart
da API também exige considerar a migração dos marcadores de sessão do PR 98.

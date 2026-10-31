# Moda Pink · Gestão da Confecção

Primeira versão premium para apresentar e validar a operação da fábrica. Projeto independente em Next.js App Router, TypeScript e Tailwind CSS 4, com a identidade do painel Moda Pink: fonte Poppins local, login escuro e dashboard clara com pink #e70289.

![Dashboard da confecção](docs/preview-dashboard.jpg)

## Executar

Requer Node.js 22.13 ou superior.

```sh
cd projects/confeccao
npm ci
npm run dev
```

Abra `http://localhost:3000`. Use **Explorar demonstração**. Os campos de login são ilustrativos, e nenhuma credencial é validada ou armazenada.

```sh
npm run typecheck
npm test
npm run build
npm start
```

A aplicação é independente do painel de WhatsApp. Nenhuma rota, API, sessão de atendimento ou conexão de banco do sistema existente é reaproveitada nesta demonstração. O TypeScript da raiz exclui esta pasta para manter os builds isolados.

## Telas e interações

| Rota | Entrega |
| --- | --- |
| `/` e `/login` | Login premium escuro e entrada demonstrativa |
| `/dashboard` | Indicadores locais, gráfico ilustrativo, etapas e alertas acionáveis |
| `/producao` | Lista e quadro, filtros, criação, reserva de tecido e avanço de etapas |
| `/materiais` | Cadastro por lote, unidade própria, entradas, perdas, saldo físico, reserva e disponível |
| `/modelos` | Ficha técnica, consumo previsto, grade, custos diretos e imagem de teste |
| `/qualidade` | Inspeção, aprovação, retrabalho, perda definitiva e reconferência |
| `/custos` | Custos diretos por lote e por peça aprovada nos lotes concluídos, exportação CSV |
| `/configuracoes` | Escopo da demonstração, cópia local dos dados e restauração dos exemplos |

## Regras já verificadas

- Uma ordem reserva tecido, sem baixar o saldo físico na criação.
- O consumo efetivo é registrado ao passar do corte para costura e libera a reserva da ordem.
- Reservas de outros lotes ficam protegidas; quilos, metros e unidades mantêm controles separados.
- A grade usa quantidades inteiras e tamanhos da ficha técnica.
- Cada peça é conferida uma única vez; retrabalho exige reconferência.
- A conclusão é bloqueada enquanto houver peças sem conferência ou retrabalhos.
- Somente aprovadas são consideradas liberadas; perdas ficam separadas.
- Custos são diretos e demonstrativos, sem rateio de despesas fixas ou impostos. O preço do tecido é preservado na abertura da ordem.

Os oito testes de regras estão em `tests/domain.test.mjs`.

## Dados e imagens nesta etapa

Os exemplos são fictícios, incluindo fornecedores, consumos e custos. O armazenamento é local ao navegador, com versão de formato e validação ao restaurar. Fotos de teste são reduzidas e guardadas localmente; formatos aceitos: JPG, PNG e WebP, até 5 MB. Armazenamento indisponível ou cheio é informado ao usuário.

O login é apenas uma tela de apresentação. As rotas são deliberadamente acessíveis na demonstração. Autenticação, autorização por perfil e validações do lado do servidor serão implementadas na etapa do banco, antes de usar dados reais.

## Preparação para a próxima etapa

`lib/domain.ts` concentra as operações puras de produção e estoque. `lib/demo-store.tsx` adapta essas operações ao navegador. A conexão ao banco deve substituir essa camada por operações transacionais no servidor, com controle de concorrência, trilha de auditoria e armazenamento protegido de imagens.

Consulte [arquitetura e próximos passos](docs/arquitetura.md). Nenhuma tabela, conta, senha, bucket ou serviço de produção foi criado nesta etapa.

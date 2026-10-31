# Arquitetura e evolução

## Estrutura

- `app/`: login e rotas do painel, com layout e limites de erro.
- `components/`: shell responsivo, formulários, detalhes de lote e componentes de interface.
- `lib/domain.ts`: entidades, quantidades, reservas, consumo, inspeção e custo direto.
- `lib/seed.ts`: exemplos descartáveis para apresentação.
- `lib/demo-store.tsx`: estado local versionado, validação de leitura e avisos de persistência.
- `tests/`: regras que protegem a integridade do fluxo demonstrativo.

## Fluxo

Ficha técnica → ordem planejada e reserva → corte → consumo registrado e costura → acabamento → conferência → resolução de retrabalhos → lote concluído.

As peças aprovadas são contadas separadamente das perdas. Lotes concluídos são a base dos indicadores de custo por peça liberada.

## Limites intencionais da apresentação

Há uma matéria-prima principal por ordem. Os aviamentos podem ser cadastrados e movimentados, e seus custos são informados por peça na ficha; o consumo automático de múltiplos aviamentos ainda não faz parte desta versão. Cada linha de material representa um lote ou rolo, em sua unidade de controle. Os serviços usam os valores cadastrados na ficha atual e ainda não têm versionamento próprio. O gráfico usa uma distribuição ilustrativa dos volumes de exemplo e não deve ser utilizado como relatório histórico real.

## Próxima etapa, depois da validação com a fábrica

1. Confirmar etapas reais, unidades, rendimento dos tecidos, produção própria ou facção, grade e critérios de qualidade.
2. Definir banco e autenticação sem reutilizar credenciais da operação atual.
3. Implementar usuários e permissões de gestão, produção e qualidade no servidor.
4. Criar registros relacionados para materiais/lotes, modelos e versões, ordens/grades, movimentos, inspeções e serviços.
5. Gravar reserva, consumo e inspeção em transações, impedindo concorrência e duplicidade de envio.
6. Mover fotos para armazenamento privado e registrar somente metadados e referências no banco.
7. Versionar fichas e custos de serviços para preservar o histórico completo por ordem.
8. Adicionar movimentação de produto acabado e avaliar integração com a venda apenas após liberação de qualidade.

O provedor de banco não foi criado nem configurado neste trabalho. A persistência local é exclusiva de apresentação e não substitui estoque, autenticação ou auditoria de produção.

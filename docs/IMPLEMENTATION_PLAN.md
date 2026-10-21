# Plano de evolução do Equilibra

## Objetivo e limites

Entregar a jornada resultado → avaliação humana → ação → evidência → revisão de eficácia, sem implementar novos canais de coleta. Preservar o Express e a interface existente. Não publicar nem alterar dados históricos silenciosamente.

## Sequência e critérios de aceite

1. **Recuperação e diagnóstico.** Cópia local privada de fontes e dados; testes de referência. Nenhum segredo nos relatórios ou nos arquivos de exemplo.
2. **Confiabilidade dos resultados.** Somente ciclos encerrados publicam médias. Nenhuma simulação na operação normal. Preservar relatórios publicados. Arquivar pesquisas históricas em vez de apagar evidências. Não misturar todos os períodos como situação atual.
3. **Domínio e persistência.** Extrair catálogo de instrumentos e cálculos para módulos puros; encapsular consultas e alterações em repositório. Persistência escolhida pelo usuário antes da implementação. Manter compatibilidade de leitura dos registros existentes.
4. **Resultados.** Distribuições, participação, origem e limitações. Comparações exigem versão de instrumento e público comparáveis. Registros antigos sem contexto suficiente permanecem disponíveis, sem comparação automática enganosa. Não reconstruir grupos a partir de respostas sem vínculo.
5. **Avaliações.** Achados vinculados ao resultado e fator; contexto de trabalho, evidências complementares, medidas existentes, avaliação e decisão do responsável. Controle de versões evita sobrescrever trabalho concorrente.
6. **Ações.** Responsável, prazo, prioridade, estados, evidências, critério e prazo de revisão. Encerramento depende de verificação humana; conclusão operacional não significa eficácia.
7. **Continuidade.** Painel de pendências, comparação e vínculo entre ação e remedição. Recorrência tem definição explícita, fuso e execução idempotente; não prometer agendamento sem executor.
8. **IA.** Adaptador do provedor escolhido, configuração no servidor, limite de contexto, timeout e tratamento de indisponibilidade. Somente resultados agregados publicáveis. Sugestões nunca aprovam avaliações nem ações automaticamente. Registrar autoria e origem.
9. **Colaboração.** Organização separada de usuários, papéis e convites com token protegido e expiração. Isolamento validado em toda referência entre entidades. Autor identificado no histórico.
10. **Operação comercial e dados.** Cobrança e limites definidos pelo usuário. Recuperação de conta, exportação, retenção, backup e restauração com escopo explícito. Não inventar preços ou marcar pagamento como realizado.
11. **Validação.** Testes de regressão e integração da jornada, permissões, transições, concorrência e contexto da IA. Navegador real em desktop e celular, estados vazios e erros. Registrar limites e configuração externa pendente.

## Estrutura de código

- `src/domain`: instrumentos, análises e regras de transição sem HTTP ou acesso ao disco.
- `src/repositories`: consultas, isolamento e persistência das entidades.
- `src/services`: casos de uso, histórico e integração entre resultados e ações.
- `src/integrations/ai`: adaptadores de provedores e contrato único de geração.
- `src/routes`: autenticação, validação de fronteira e respostas HTTP.
- `public/js`: navegação existente e módulos de gestão com componentes comuns.
- `tests`: contratos e fluxos com dados sintéticos isolados.

## Design e comportamento

Manter identidade verde, tipografia e navegação existentes. Resultados e ações são destinos principais. Cada tela tem uma ação principal, mensagens claras, campos rotulados, estados vazios e erros. Sem classificações clínicas, promessas automáticas de conformidade ou métricas de demonstração misturadas a resultados reais.

## Decisões confirmadas

Groq com modelo configurável, JSON nesta etapa e Mercado Pago em teste. O usuário autorizou definir planos com limites por pessoas e grupos e IA a partir do Popular. O catálogo inicial está em `src/config/plans.js`. Foi escolhido `openai/gpt-oss-120b` como modelo inicial, configurável pelo ambiente.

## Entrega e limites

Correções de publicação, remoção da simulação, snapshots históricos, arquivamento, último ciclo no painel, regras de comparação e proteção conservadora de sobreposição foram implementadas. Atribuição de respostas por grupo não foi inventada para dados antigos e depende da futura coleta.

Avaliações, ações, evidências por descrição/link, eficácia, remedição, histórico, dossiê, equipe, permissões, recuperação assistida, agendamento de rascunhos, retenção e backup local foram implementados. IA tem adaptador substituível, histórico e propostas revisáveis. Assinaturas têm catálogo, cotas, checkout, sincronização, webhook e cancelamento.

Há testes de integração com dados isolados e provedores simulados. Credenciais privadas, URL pública, validação real do Groq e ciclo de cobrança no Mercado Pago permanecem pendentes. Sem credenciais, as integrações não são apresentadas como ativas. A coleta futura, múltiplas empresas por consultoria, MFA, backup externo e auditoria imutável não fazem parte desta implementação local.

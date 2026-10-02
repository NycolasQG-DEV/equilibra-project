# Equilibra — avaliação do produto e plano de evolução

Data: 1º de outubro de 2026. Escopo: **uma assinatura para uma empresa**, que pesquisa exclusivamente seus próprios funcionários. A empresa pode convidar pessoas da sua equipe para gerir o trabalho na mesma conta.

## Veredito

O pagamento, a criação de pesquisas, os links individuais e a leitura protegida de respostas formam uma prova técnica válida. Ainda não formam um produto operacional para RH/SST: a empresa precisa distribuir links manualmente, não consegue delegar trabalho à equipe, não administra um ciclo de prevenção e não recebe uma visão de evolução. A promessa comercial deve ser **transformar sinais sobre condições de trabalho em medidas acompanhadas e evidências utilizáveis pela equipe técnica**, sem alegar que um questionário substitui AEP, inventário de riscos ou PGR.

O [MTE esclarece](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026/@@download/file) que questionários são opcionais, não há instrumento oficial único e seus resultados isolados não comprovam gestão dos riscos psicossociais. A avaliação técnica e a implementação das medidas continuam sob responsabilidade da organização. A [OMS recomenda intervenções organizacionais](https://www.who.int/news-room/fact-sheets/detail/mental-health-at-work) que modifiquem condições de trabalho, com participação dos trabalhadores. Portanto, o centro do produto deve ser o ciclo de ação, não o volume de questionários.

## Leitura como cliente

| Momento | Experiência atual | Consequência |
| --- | --- | --- |
| Após pagar | O gestor ainda precisa criar uma “empresa cliente”, podendo criar várias. | A conta não parece representar sua própria empresa; o cadastro inicial não orienta o primeiro resultado. |
| Preparar pesquisa | Há base e rascunho por IA, com revisão de perguntas. | É um bom início, mas não há protocolo revisado por especialista nem orientação sobre amostra, período e método. |
| Envolver a equipe | Não existe equipe com papéis de leitura, edição e administração. A antiga rota de usuários redireciona para outro módulo. | RH, SST e direção acabam compartilhando a conta ou ficam sem acesso. |
| Convidar respondentes | São gerados links únicos, exibidos uma vez e copiados manualmente. | Sem lista de destinatários, envio, falhas de entrega ou lembrete, a operação de 100 a 2.000 pessoas é impraticável. |
| Interpretar | Após fechar a rodada aparecem contagens, categorias simples e sugestões estáticas. Grupos pequenos são ocultos. | Falta taxa de resposta por universo, comparação segura no tempo, leitura por dimensão e contexto para decidir prioridade. |
| Agir | O relatório sugere medidas, mas não registra decisão, responsável real, prazo, evidência ou revisão. | A empresa não consegue mostrar o que fez nem avaliar se funcionou. |

Isto é uma avaliação do fluxo implementado no código, não um teste de usabilidade com clientes reais.

## Decisão de produto: uma empresa, três públicos

**Empresa assinante** é a unidade da conta e da cobrança: uma assinatura corresponde a uma empresa. O cadastro cria ou vincula exatamente essa empresa; existe um responsável principal. Ela não cadastra clientes nem outras empresas dentro da assinatura. Se já houver contas com mais de uma empresa por causa do modelo antigo, a migração exige identificar a empresa principal e preservar os dados antes de aplicar a restrição única no banco.

No código atual, a assinatura pertence ao usuário administrador e a empresa é uma entidade separada. Para cumprir literalmente **uma assinatura por empresa**, o vínculo de cobrança deve passar a usar a empresa como titular, com identificador empresarial validado, regra para filiais e proteção contra duas contas assinarem pela mesma empresa. A interface e a API agora barram uma segunda empresa na mesma conta; a migração da cobrança e a restrição única no banco ainda fazem parte do trabalho prioritário.

**Equipe gestora** recebe convite por e-mail para entrar na *mesma* empresa. Não são respondentes; seus e-mails servem para autenticação, comunicação de convite e auditoria.

| Papel | Pode fazer | Não pode fazer |
| --- | --- | --- |
| Visualização | Ver painel e relatórios agregados já liberados; acompanhar ações atribuídas, sem dados individuais. | Criar/editar/publicar pesquisa, convidar usuários, exportar dados brutos ou alterar cobrança. |
| Edição de pesquisa | Criar e editar rascunhos; abrir e encerrar rodadas; acompanhar participação e resultados agregados; propor ações. | Gerir equipe, permissões, assinatura ou configurações sensíveis. |
| ADM | Tudo acima, além de gerir membros, empresa, configurações, planos e aprovar/atribuir ações. | Não recebe acesso a respostas individuais ou à identidade do respondente. |

O responsável principal é um ADM protegido contra remoção ou rebaixamento que deixe a empresa sem administrador. Autorização deve ocorrer **no servidor em cada endpoint**, usando vínculo `usuário ↔ empresa ↔ papel`, não apenas no menu. Convites de equipe têm token de uso único, expiração, aceite e revogação; não se define senha de terceiros. Mudanças de papel e acesso a relatórios precisam de trilha de auditoria.

**Funcionários respondentes** pertencem à própria empresa assinante e são uma população separada da equipe gestora: cadastro/importação de e-mails e, quando necessário, setor ou unidade. Eles respondem por convite sem conta de gestão. O cadastro de destinatários não deve guardar associação entre pessoa e resposta. Tokens, registros de entrega e métricas de participação precisam ser desenhados para não permitir reidentificação por gestores ou por combinações de filtros. A [ANPD trata anonimização como um processo baseado em risco](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/documentos-tecnicos-orientativos), portanto o mínimo de cinco respostas é uma trava inicial, não garantia universal de anonimato.

## Fluxo alvo do MVP vendável

1. **Ativar:** ao entrar, o ADM informa nome da empresa, porte, áreas de avaliação e contato de privacidade; convida RH/SST. O produto apresenta o próximo passo e um exemplo de relatório.
2. **Planejar:** escolher avaliação de condições de trabalho ou pesquisa pontual; definir objetivo, população, setores, período e método. A base deve ser revisada por especialista de SST antes da oferta como referência técnica. IA só propõe perguntas e explica limites; publicação exige revisão humana.
3. **Distribuir:** importar/cadastrar destinatários, validar e deduplicar e-mails, pré visualizar mensagem, disparar convites com link individual, registrar entrega/falha e permitir lembrete apenas a quem ainda não participou, sem expor respostas. Oferecer QR/link geral apenas com proteção contra respostas duplicadas e amostra enviesada claramente indicada.
4. **Acompanhar:** mostrar convidados, entregues, respondidos e taxa de participação por universo elegível; alertar sobre baixa cobertura ou áreas sem amostra suficiente. Não revelar quem respondeu para o gestor.
5. **Decidir:** ao fechar, apresentar dimensões, diferenças relevantes entre rodadas comparáveis, limites da amostra e achados priorizados. Aplicar supressão de grupos pequenos e proteção contra inferência por filtros, cruzamentos e comparação entre rodadas.
6. **Agir:** transformar cada achado em decisão registrada: medida organizacional, responsável, prazo, indicador, evidência e status. A equipe técnica aprova, altera ou rejeita sugestões e documenta a razão.
7. **Verificar:** após execução, registrar evidência e efeito observado, agendar reavaliação adequada e exportar um dossiê com metodologia, versão das perguntas, cobertura, resultados liberados, decisões e histórico de ações para subsidiar AEP/PGR.

## Devolutiva, painéis e previsões que podem orientar decisões reais

### Devolutiva para quem respondeu

Depois do encerramento, a empresa publica um resumo em linguagem simples para todos os funcionários elegíveis: **o que foi ouvido**, **quais medidas foram aprovadas**, **quem é responsável pela execução** e **quando haverá atualização**. A publicação é revisada por ADM/SST, mostra somente resultados agregados liberados e pode ser entregue por e-mail ou página acessível por link da empresa. Não apresenta comentários individuais, setores abaixo do limiar de privacidade, nomes de respondentes nem promete solução para problemas ainda sem medida definida. Em cada atualização, mostra o andamento e a evidência da medida; isso fecha a escuta e dá razão para participar novamente.

### Painéis orientados a tarefas

| Painel | Pergunta que responde | Informação mínima | Ação disponível |
| --- | --- | --- | --- |
| Direção/ADM | Onde precisamos decidir e investir? | Cobertura da pesquisa, fatores que merecem avaliação, evolução comparável, ações atrasadas, evidências e limites de interpretação. | Aprovar prioridade e cobrar responsável. |
| RH/SST | O que foi observado e como vamos verificar? | Versão do instrumento, universo elegível, respostas válidas, dimensões, setores liberados, qualidade da amostra, histórico e hipóteses organizacionais. | Investigar contexto, registrar avaliação técnica e abrir ação. |
| Operação da pesquisa | A campanha alcançará a amostra planejada? | E-mails válidos, convites enviados/entregues, falhas, participação agregada e tempo restante. | Corrigir entrega, enviar lembrete controlado ou prolongar prazo. |
| Ações | Estamos mudando condições de trabalho? | Medida, dono, prazo, recurso, marco, evidência, status e data de reavaliação. | Atualizar execução e documentar efeito observado. |
| Funcionários | O que a empresa fez com as respostas? | Resumo agregado seguro, compromissos assumidos, andamento e próxima devolutiva. | Acompanhar medidas e participar da próxima rodada. |

Um gráfico só entra no painel se responder a uma decisão. Cada indicador traz período, denominador, versão das perguntas, nível de cobertura e motivo quando não pode ser exibido. Filtros e comparações obedecem a supressão contra reidentificação e diferenças entre grupos pequenos.

### Escada de previsões

**1. Imediata: projeção operacional de participação.** Depois de instrumentar entrega, abertura e resposta ao longo do tempo, estimar a chance de uma campanha atingir a cobertura planejada até o fechamento. Mostrar faixa de incerteza e o que mais altera a projeção, como falhas de e-mail ou dias restantes. A recomendação prática é corrigir entrega, ampliar janela ou programar lembrete. Isso prevê um resultado operacional observável, sem fazer inferência sobre a saúde de pessoas.

**2. Após ciclos comparáveis: tendência dos fatores de trabalho.** Estimar se um indicador agregado tende a melhorar, ficar estável ou piorar na próxima rodada **somente** quando houver histórico suficiente da mesma dimensão, instrumento comparável, amostra adequada e cobertura conhecida. Mudança de questionário, setor pequeno ou resposta enviesada bloqueiam a previsão e mostram “dados insuficientes”. O painel separa resultado observado de projeção e não chama correlação de causa.

**3. Após integração e validação: cenários de impacto.** Se a empresa fornecer indicadores agregados de RH/SST, como absenteísmo por área e período, o sistema pode investigar relações com condições de trabalho e comparar o antes/depois de medidas. Uma simulação do tipo “se esta medida for executada” é apresentada como cenário com premissas, nunca como efeito garantido. Dados clínicos ou previsão de adoecimento individual ficam fora do produto.

Nenhum modelo entra em produção apenas porque gerou um número. Definir previamente o alvo, a janela de previsão e o dado conhecido no momento da decisão; testar em períodos posteriores aos usados no treino; comparar com uma regra simples; medir erro, calibração, cobertura dos intervalos e desempenho por porte de área; monitorar degradação. Se não superar a referência ou não houver amostra suficiente, o produto mostra apenas o observado. O [NIST recomenda validação, comparação com referências e medidas de incerteza](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) para sistemas de IA.

### Motor de soluções

O sistema sugere **medidas sobre o trabalho** a partir de achados agregados e contexto informado pela empresa: por exemplo, revisar distribuição de demanda, escala, autonomia, suporte de liderança, canais de prevenção de assédio ou processo de comunicação. Cada proposta explicita: problema observado, evidência e lacunas, hipótese de causa, medida possível, esforço, responsável sugerido, prazo e indicador de verificação. O gestor pode aceitar, adaptar ou rejeitar; a equipe de SST registra avaliação técnica. A eficácia só é marcada depois de evidência de implementação e reavaliação. A [OMS destaca intervenções organizacionais](https://www.who.int/news-room/fact-sheets/detail/mental-health-at-work) e o [MTE exige acompanhamento das medidas de prevenção](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/pgr/principal).

**Critério de lançamento do módulo analítico:** um gestor consegue responder “qual problema priorizamos, por quê, o que fizemos, qual resultado observamos e quanta confiança temos nessa leitura?” sem depender de uma conclusão inventada pela IA.

## Backlog por prioridade

### P0 — tornar o produto utilizável por uma empresa

1. **Empresa, assinatura e equipe:** uma empresa por conta, assinatura vinculada à empresa, membros convidados, três papéis e autorização no servidor. Aceite: não é possível criar segunda empresa na conta nem duas assinaturas para a mesma empresa; usuário de uma empresa não acessa dados de outra por URL/API; visualizador não altera pesquisa; editor não altera membros ou cobrança; ADM gerencia equipe; último ADM permanece protegido.
2. **Convites por e-mail:** cadastro/importação de destinatários, envio real, estados de entrega e reenvio controlado. Aceite: uma rodada de 100 pessoas pode ser iniciada sem copiar 100 links; falhas e e-mails inválidos são identificados; resposta continua sem login e sem identificação no relatório.
3. **Onboarding e painel inicial:** remover seletor de empresas, mostrar empresa, plano, equipe, pesquisas abertas, participação e próximo passo. Aceite: uma conta nova conclui o primeiro envio sem consultar documentação externa.
4. **Segurança operacional:** verificar assinatura vigente em todas as APIs de produto; recuperação de acesso por e-mail real; cookies de sessão seguros; auditoria de ações administrativas. Aceite: conta sem plano vigente não abre nova rodada; a política contratual define acesso e exportação do histórico após vencimento; convite revogado não funciona; alterações de permissão ficam registradas.

### P1 — justificar recorrência e impacto

5. **Plano de ação executável:** decisão, responsável, prazo, progresso, evidência, comentário e revisão. Aceite: todo achado priorizado pode virar ação rastreável; um relatório mostra ações atrasadas, concluídas e eficácia verificada.
6. **Relatório técnico utilizável:** versão do instrumento, método, tamanho do universo, participação, restrições, achados, medidas e exportação estável. Aceite: a equipe de SST consegue anexar o material ao seu processo de AEP/PGR sem reescrever manualmente os dados; a plataforma não declara conformidade automática.
7. **Comparação longitudinal segura:** tendências por dimensão e setor quando amostras são suficientes e perguntas equivalentes. Aceite: comparação não expõe grupos pequenos, informa mudança de questionário e distingue variação de percepção de efeito comprovado da ação.
8. **Calendário e lembretes:** agendamento de abertura/fechamento e recorrência com fuso horário, opt-out e limites de envio. Aceite: tarefas acontecem sem o gestor manter a página aberta; falhas geram registro e tentativa controlada.
9. **Devolutiva aos funcionários:** publicar resumo seguro, medidas aprovadas, responsáveis institucionais, andamento e próxima revisão. Aceite: a empresa consegue comunicar o que fez após cada rodada sem revelar pessoas ou grupos pequenos.
10. **Painéis de decisão e soluções:** visão específica para direção, RH/SST, operação e ações; sugestões com evidência, hipótese, medida, custo aproximado e forma de verificação. Aceite: o usuário consegue converter achado em ação revisada por humano e acompanhar a execução.
11. **Projeção de participação:** prever a chance de atingir a cobertura planejada usando histórico de entrega e resposta, com faixa de incerteza e recomendação operacional. Aceite: o modelo supera uma referência simples em validação temporal; caso contrário, a projeção não aparece.

### P2 — diferenciação após validar a base

12. **Previsão de tendência validada:** prever indicadores agregados em rodadas futuras apenas com séries comparáveis e desempenho demonstrado fora da amostra. Exibir intervalo e fatores que invalidam a previsão; nunca prever diagnóstico individual.
13. **Escuta participativa:** permitir que representantes discutam problemas e medidas de modo protegido, complementando a pesquisa com contexto de trabalho.
14. **Integrações e cenários:** SSO, diretório de pessoas e exportação para sistemas de SST/RH; simular cenários apenas quando houver dados agregados suficientes e premissas explícitas.

## O que cortar ou corrigir

- Retirar o modelo de consultoria/múltiplas empresas da experiência e impedir novas organizações adicionais no banco após migração.
- Não usar o módulo antigo de “colaborador com senha” como convite de equipe: ele pertence a outro fluxo e mistura respondente com usuário administrativo.
- Não chamar a base de “matriz oficial da NR-1”, “laudo auditável” ou “conformidade automática”: o MTE não estabelece instrumento oficial único nem aceita questionário isolado como gestão de riscos.
- Não vender “IA preditiva” ou análise de sentimento clínica com o classificador atual de palavras-chave.
- Revisar a regra que oculta uma pergunta inteira sempre que uma das cinco opções recebe 1 ou 2 respostas: protege privacidade, mas pode esvaziar a maioria dos relatórios pequenos. Usar agregações e faixas seguras, com teste de inferência antes da liberação.
- Remover textos antigos de assinatura que ainda citam apenas PIX ou prometem acesso de “colaboradores” como se todos tivessem conta.

## Planos e preço

Os limites atuais são 10, 50 e 9.999 **convites por mês** para R$ 99, R$ 249 e R$ 499. Isso conflita com o cliente definido (100 a 2.000+ pessoas) e penaliza pesquisas frequentes: uma empresa de 200 pessoas já não cabe nos dois primeiros planos para uma única rodada. Todas as faixas anunciam praticamente o mesmo conjunto de funções. A assinatura, na prática, compra capacidade de gerar links, e não um resultado operacional.

Proposta para testar em pilotos: uma assinatura por empresa; faixas de **população ativa de funcionários** e assentos da equipe gestora, com campanhas e pulsos incluídos em política de uso justo. Recursos de distribuição, privacidade, ação e relatório devem existir desde o plano de entrada. Planos superiores podem acrescentar mais assentos, integrações, SSO, suporte e maior capacidade de população. Não fixar novos preços sem entrevistar compradores, observar custo de envio/IA/suporte e medir disposição a pagar pelo ciclo completo.

## Validação com clientes

Piloto com 2–3 empresas do ICP e um profissional de SST responsável pela interpretação. Observar dois ciclos: avaliação inicial → ação implementada → verificação. Métricas propostas como hipóteses de sucesso, a ajustar após o primeiro piloto:

- tempo para primeira campanha enviada e porcentagem de empresas que a concluem;
- convites entregues, taxa de participação e cobertura por área elegível;
- proporção de achados que viram decisão com responsável e prazo;
- ações executadas no prazo e com evidência;
- clientes que realizam a segunda medição e dizem que o relatório ajudou uma decisão concreta;
- incidentes de privacidade, bloqueios por grupo pequeno e pedidos de esclarecimento sobre anonimato.

**Definição de MVP pronto para cobrar:** uma empresa consegue convidar sua equipe, lançar pesquisa para sua população por e-mail, obter resultados interpretáveis e protegidos, registrar pelo menos uma medida com responsável e prazo, e voltar para verificar o efeito. Hoje esse percurso não se completa.

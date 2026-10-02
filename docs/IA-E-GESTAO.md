# Equilibra: IA, evidências e gestão
Atualização: 25/09/2026.

## O que mudou
O produto separa escuta, cálculo, sugestão e decisão. A IA escolhe perguntas de aprofundamento e auxilia a ordenar propostas de um catálogo. Percentuais, denominadores, permissões e gravações são controlados pelo servidor. Não há valores de probabilidade, severidade ou certeza inventados pelo modelo.

O protocolo equilibra-percepcao-2 é um instrumento próprio de percepção, com sete perguntas de frequência sobre as últimas duas semanas. Não é uma aplicação validada de COPSOQ/ISTAS21. Deve passar por revisão dos responsáveis de SST e avaliação metodológica antes do uso operacional. Cobrir sete temas não garante identificação exaustiva de perigos.

## Fluxo
1. O gestor autenticado informa campanha, setor, contexto de trabalho e quantidade de links.
2. A emissão consome a cota de links do mês civil, usando max_colaboradores do plano atual. A transação serializa emissões da mesma conta. Essa unidade de cobrança deve ser refletida nos termos comerciais; esta mudança não implementa nova cobrança no Mercado Pago.
3. Um convite aleatório aceita uma participação. A reserva é atômica. Cookie HttpOnly e SameSite vinculam a participação ao navegador. O endereço sozinho não abre o histórico.
4. O aviso exige confirmação explícita, não pré-marcada. Ditado é opcional. Não são coletados nome, cargo, turno ou tempo de empresa.
5. Há sete escolhas padronizadas, até sete comentários opcionais e uma sugestão final. O participante pode pular perguntas. Textos livres não alteram frequência. Comentários são preservados para o próprio participante, não são enviados ao LLM nem publicados ao gestor nesta versão.
6. O servidor controla a sequência, rejeita respostas atrasadas e valores fora das opções. Concluir exige finalizar o protocolo. Falha de rede não é exibida como conclusão.
7. O gestor encerra a campanha: a operação bloqueia novas conclusões e preserva uma rodada estável para divulgação. Não há reabertura nem exclusão de resultados pela interface do gestor.
8. O painel publica somente agregados. Uma proposta adotada ganha responsável e prazo editáveis. Concluir execução exige evidência; execução e eficácia são conceitos separados.

## Métricas e proteção
- Numerador: escolhas Frequentemente ou Sempre.
- Denominador: escolhas explícitas Nunca, Raramente, Às vezes, Frequentemente e Sempre.
- Recusa, não aplicabilidade e ausência não entram como respostas favoráveis.
- Exigem-se pelo menos 10 participantes válidos por tema.
- Células com 1 ou 2 respostas desfavoráveis, ou 1 ou 2 no complemento, ficam protegidas. A tabela não revela seus denominadores.
- Não há acesso do gestor a transcrições ou relatórios individuais. Contagem de links concluídos serve para operação da coleta.
- Comparações exigem mesmo setor, protocolo e períodos encerrados. Diferença expressa em pontos percentuais. São rodadas transversais: participantes e composição podem mudar.
- Não há inferência de causalidade, teste de significância, estimativa de risco ocupacional ou nota geral de saúde mental.
- Exportação CSV neutraliza células que poderiam executar fórmulas. Impressão exporta a visualização atual.
- O limiar de divulgação é uma política do produto, não um limiar imposto pela NR-1/LGPD. Não elimina todo risco de reidentificação; o distribuidor pode conhecer a associação entre convite e pessoa. Evitar grupos facilmente reconhecíveis continua necessário.

## IA e defesa em camadas
Os prompts estão em lib/ai/prompts. A política comum proíbe diagnóstico, profiling psicológico, números sem fonte, acesso cruzado, ferramentas e mudança de regras por conteúdo recebido.

A saída é validada em tempo de execução:
- Entrevista: apenas followup_id 0 ou 1; o servidor exibe uma pergunta aprovada.
- Síntese: apenas dimension_ids autorizados e sem duplicatas, até três; o sistema preserva os três maiores sinais divulgáveis e materializa evidência e ação do catálogo.
- Assistente do gestor: intenção permitida e dimensão autorizada; resposta composta com agregados da conta.
- Conteúdo fora do contrato, truncado, indisponibilidade e timeout levam a uma alternativa determinística. Não se mostra JSON bruto, código, markdown gerado ou texto arbitrário do provedor.

Não existe garantia de imunidade absoluta a prompt injection. Uma escolha válida do modelo ainda pode ser pouco pertinente. O impacto foi limitado a escolhas aprovadas, sem permissão para alterar dados, executar ferramentas ou inventar métricas. Os testes adversariais usam respostas simuladas; não equivalem a uma auditoria externa nem certificam todos os modelos.

## Estilo e transparência
A revisão editorial se baseou em [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing): evitar análise superficial, linguagem promocional, atribuições vagas, conclusões padronizadas e formatação excessiva. A página é descritiva, não prova de autoria nem política formal da Wikipédia. As orientações foram adaptadas ao português e ao atendimento breve. A interface informa que a assistente é virtual.

A narração e o ditado usam recursos opcionais do navegador; qualidade e processamento externo dependem do navegador/sistema. O endpoint de TTS exige a sessão do participante e aceita apenas trechos da pergunta atual, com limite de uso e tempo de resposta. A voz neural anterior foi preservada, com alternativa do navegador. Não há envio de comentários para síntese de voz. O participante revisa o ditado antes de enviar.

## Configuração
Manter somente no ambiente do servidor:
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.
- JWT_SECRET: valor aleatório de pelo menos 32 caracteres. Não há segredo padrão no código.
- GROQ_API_KEY e GROQ_MODEL: modelo com suporte ao contrato JSON. Sem chave ou resposta válida, o fluxo usa as opções determinísticas.
- APP_URL: origem exata de produção, incluindo protocolo e porta se houver; usada na proteção de requisições.
- PRIVACY_CONTACT e PRIVACY_CONTACT_NAME: contato real do controlador/encarregado.
As variáveis existentes do Mercado Pago não foram substituídas.

## Migração e operação
As tabelas management_batches, management_actions e request_limits são criadas na inicialização existente. Links e relatórios do instrumento antigo são preservados, mas não misturados às métricas nem disponibilizados via rotas individuais do gestor. Convites antigos precisam ser substituídos por campanhas novas. Não se deve atribuir retrospectivamente um protocolo ou consentimento novo a registros antigos.

Foi removido o seed que recriava/alterava automaticamente a senha da conta de demonstração. Se essa conta já existe, sua senha e plano não são modificados por esta atualização. Remova ou proteja contas de demonstração antes de disponibilizar o ambiente externamente.

Credenciais exibidas em captura de tela precisam ser revogadas/substituídas pelo responsável nos respectivos provedores, inclusive o segredo JWT. Este trabalho não executa rotação no provedor nem imprime o conteúdo de .env.

## Limites para entrada em produção
O aviso e o botão de aceite não bastam para afirmar conformidade com a LGPD. O controlador precisa documentar as bases legais adequadas, necessidade de tratamento, retenção/exclusão, contratos, transferência internacional, direitos dos titulares e medidas de segurança da infraestrutura. O produto não oferece neste patch uma rotina completa de expurgo/backup ou atendimento de direitos; o contato deve estar operacional. Não coletar dados reais antes de resolver essas definições.

Também permanecem necessários: revisão técnica do instrumento e dos critérios de gestão; verificação de acessibilidade e voz nos navegadores usados; teste real controlado com o modelo configurado; monitoramento operacional; avaliação do risco de reidentificação e revisão de segurança de autenticação/cobrança fora das rotas refatoradas. Não houve teste de cobrança real nem alteração de assinatura externa.

A pesquisa é uma entrada para a avaliação dos fatores psicossociais relacionados ao trabalho. O inventário de riscos, a avaliação das condições reais e o plano de ação com acompanhamento continuam necessários.

## Referências
- [MTE: Perguntas e respostas sobre GRO/PGR, maio de 2026](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026/@@download/file): questionários não bastam, por si, para o processo de gerenciamento.
- [LGPD, Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
- [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs): suporte depende do modelo; JSON válido sozinho não valida aderência ao esquema.

## Verificação reproduzível
- npm run typecheck
- npm test
- npm run test:integration (MySQL local necessário; cria e remove apenas um banco aleatório eq_validation_*)
- npm run build

A integração usa participantes e contas sintéticos em banco isolado e desativa chamadas externas de IA. Não testa dados reais.

## Revisão visual solicitada
A pesquisa recuperou o layout original do projeto, incluindo fundo, tipografia, transições, iluminação e voz. Consentimento explícito e controles do servidor foram mantidos. O painel foi separado do relatório: mapa de atenção por tema/rodada, série temporal, barras comparativas e quadro de ações. O relatório de cada campanha apresenta evidências, propostas, responsáveis e prazos sugeridos, recursos e critérios de verificação, além de exportação CSV e impressão/PDF.

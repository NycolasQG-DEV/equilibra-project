/* Solution Catalog: Curated NR-1 preventive recommendations mapped to psychosocial risk factors */

export const SOLUTIONS_MAP = {
  // Volume, Carga e Ritmo
  volume: {
    title: 'Redistribuição de Carga de Trabalho & Análise de Capacidade',
    category: 'Organização do Trabalho (NR-1)',
    diagnosis: 'Volume elevado de demandas ultrapassando a capacidade da jornada normal, gerando acúmulo e risco de sobrecarga física e mental.',
    measure: 'Mapear fluxos de trabalho da área, nivelar a distribuição de demandas entre colaboradores e estabelecer limites operacionais para tarefas emergenciais.',
    owner: 'Gestão Operacional & RH',
    days: 30,
    criteria: 'Redução de horas extras não planejadas e média do fator acima de 3,6 no ciclo seguinte.',
    description: 'Ação técnica preventiva NR-1 para readequação de postos com sobrecarga crônica.'
  },
  volume_quantitativo: {
    title: 'Dimensionamento Operacional & Adequação de Quadros',
    category: 'Organização do Trabalho (NR-1)',
    diagnosis: 'Desproporção entre volume quantitativo de tarefas e tempo hábil para execução.',
    measure: 'Conduzir estudo de tempos e métodos junto à equipe para redimensionar equipes e eliminar tarefas redundantes.',
    owner: 'Gestão Operacional & Diretoria',
    days: 45,
    criteria: 'Eliminação do acúmulo contínuo de tarefas pendentes e estabilização do ritmo.',
    description: 'Adequação ergonômica e organizacional da capacidade produtiva (NR-1 / NR-17).'
  },
  volume_estavel: {
    title: 'Nivelamento de Picos Operacionais & Escala Flexível',
    category: 'Organização do Trabalho (NR-1)',
    diagnosis: 'Instabilidade no volume mensal de trabalho com concentração excessiva de demandas.',
    measure: 'Implantar cronograma compartilhado de entregas e buffers de capacidade para absorção de picos.',
    owner: 'Liderança Imediata & RH',
    days: 30,
    criteria: 'Estabilização da entrega sem necessidade de extensão de jornadas.',
    description: 'Equalização do fluxo de trabalho no ciclo contínuo de monitoramento.'
  },
  demandas: {
    title: 'Revisão dos Prazos de Entrega e Mitigação de Pressão Temporal',
    category: 'Carga Mental & Ritmo',
    diagnosis: 'Pressão intensa e prazos inexequíveis gerando estresse ocupacional e sensação de urgência constante.',
    measure: 'Revisar acordos de nível de serviço (SLAs) com clientes internos e externos para estabelecer prazos técnicos compatíveis.',
    owner: 'Gestores de Área & RH',
    days: 30,
    criteria: 'Cumprimento de 90%+ dos prazos em horário regular sem estresse excessivo.',
    description: 'Ajuste de metas e cadência operacional conforme requisitos da Portaria MTE NR-1.'
  },
  prazos_pressao: {
    title: 'Repactuação de Cronogramas e SLAs Operacionais',
    category: 'Carga Mental & Ritmo',
    diagnosis: 'Prazos irrealistas forçando aceleração prejudicial à integridade dos colaboradores.',
    measure: 'Definir margens de segurança em cronogramas de projetos e proibir prazos incompatíveis com a complexidade técnica.',
    owner: 'Gerência de Projetos & RH',
    days: 30,
    criteria: 'Adequação dos cronogramas à capacidade real de entrega dos times.',
    description: 'Medida preventiva de proteção contra estresse e pressão temporal crônica.'
  },
  ritmo: {
    title: 'Equalização do Ritmo de Trabalho & Pausas Programadas',
    category: 'Ergonomia & Ritmo (NR-17)',
    diagnosis: 'Ritmo acelerado contínuo com ausência de micropausas para recuperação cognitiva.',
    measure: 'Implementar intervalos regulares de descompressão (NR-17) e vedar cobranças contínuas por produtividade extrema.',
    owner: 'SESMT & Gestão de Área',
    days: 20,
    criteria: 'Instituição de pausas regulares comprovadas em registro operacional.',
    description: 'Prevenção de fadiga e LER/DORT decorrentes de ritmo acelerado.'
  },
  ritmo_continuo: {
    title: 'Protocolo de Ritmo Sustentável & Pausas Fisiológicas',
    category: 'Ergonomia & Ritmo (NR-17)',
    diagnosis: 'Ritmo ininterrupto sem alternância de esforço mental e físico.',
    measure: 'Garantir alternância de atividades e pausas fisiológicas sem penalidade de metas.',
    owner: 'SESMT & Lideranças',
    days: 30,
    criteria: 'Cumprimento integral dos intervalos previstos na NR-17.',
    description: 'Garantia de sustentabilidade física e psicológica na jornada diária.'
  },
  interrupcoes: {
    title: 'Instituição de Janelas de Foco & Redução de Ruído Operacional',
    category: 'Organização do Trabalho (NR-1)',
    diagnosis: 'Interrupções contínuas fragmentando o raciocínio e aumentando o tempo de resposta e retrabalho.',
    measure: 'Estabelecer blocos de horário para trabalho concentrado sem reuniões e consolidar canais de mensagens instantâneas.',
    owner: 'Gestão Operacional',
    days: 15,
    criteria: 'Redução comprovada das queixas de interrupções e melhora na concentração.',
    description: 'Organização da comunicação interna para preservação do foco mental.'
  },
  demandas_cognitivas: {
    title: 'Otimização de Processos Complexos & Automação de Rotinas',
    category: 'Carga Mental & Cognição',
    diagnosis: 'Sobrecarga de atenção sustentada e esforço cognitivo acima do tolerável.',
    measure: 'Padronizar checklists operacionais e automatizar tarefas repetitivas para desonerar a memória operacional.',
    owner: 'TI / Operações & RH',
    days: 45,
    criteria: 'Diminuição de erros por distração e alívio da carga cognitiva percebida.',
    description: 'Suporte procedural para mitigação de sobrecarga cognitiva.'
  },
  demandas_emocionais: {
    title: 'Programa de Descompressão e Suporte Socioemocional',
    category: 'Saúde Ocupacional',
    diagnosis: 'Exposição frequente a situações de conflito com clientes ou tensão emocional sem suporte institucional.',
    measure: 'Oferecer plantão de apoio psicológico e protocolos claros para mediação de atritos com clientes ou usuários.',
    owner: 'RH & SESMT',
    days: 30,
    criteria: 'Adesão de colaboradores com alta demanda emocional e redução de queixas.',
    description: 'Proteção contra exaustão gerada por trabalho emocional intenso.'
  },

  // Autonomia e Clareza de Papéis
  clareza: {
    title: 'Matriz RACI de Responsabilidades e Alinhamento de Escopo',
    category: 'Clareza Organizacional',
    diagnosis: 'Ambiguidade de papéis gerando insegurança, retrabalho e conflitos de competência.',
    measure: 'Elaborar e divulgar matriz RACI (Responsável, Aprovador, Consultado, Informado) detalhada para cada função e projeto.',
    owner: 'RH & Liderança Direta',
    days: 30,
    criteria: '100% dos integrantes com escopo documentado e alinhado formalmente.',
    description: 'Alinhamento estrutural de atribuições e metas da NR-1.'
  },
  clareza_papel: {
    title: 'Definição Formal de Atribuições e Metas Operacionais',
    category: 'Clareza Organizacional',
    diagnosis: 'Colaboradores sem clareza quanto ao que é esperado de seu desempenho individual.',
    measure: 'Revisão das descrições de cargo e realização de alinhamentos 1-a-1 com líderes imediatos.',
    owner: 'RH & Gestores de Área',
    days: 30,
    criteria: 'Registro formal de alinhamento individual em todos os setores avaliados.',
    description: 'Eliminação da indefinição de atribuições no ambiente de trabalho.'
  },
  papel: {
    title: 'Manual de Governança de Papéis & Eliminação de Conflito de Ordens',
    category: 'Clareza Organizacional',
    diagnosis: 'Orientações contraditórias emitidas por diferentes lideranças ou áreas.',
    measure: 'Instituir canal único de repasse de prioridades e resolução de conflito de ordens entre coordenações.',
    owner: 'Diretoria Operacional & RH',
    days: 30,
    criteria: 'Zero ocorrências de duplicidade de ordens ou retrabalho decorrente de desalinhamento.',
    description: 'Harmonização da governança e comando nas frentes de trabalho.'
  },
  prioridades: {
    title: 'Rituais de Priorização Semanal & Alinhamento de Demandas',
    category: 'Organização do Trabalho (NR-1)',
    diagnosis: 'Demandas concorrentes com orientações incompatíveis gerando ansiedade e paralisia operacional.',
    measure: 'Adotar reunião semanal de alinhamento com matriz de priorização compartilhada (urgência x impacto).',
    owner: 'Liderança Imediata',
    days: 15,
    criteria: 'Transparência de prioridades acordada e documentada a cada ciclo semanal.',
    description: 'Critérios objetivos de priorização das demandas da equipe.'
  },
  autonomia: {
    title: 'Protocolo de Delegação Estruturada e Empoderamento Decisório',
    category: 'Autonomia & Participação',
    diagnosis: 'Microgestão excessiva e dependência de aprovações para decisões simples do cotidiano.',
    measure: 'Definir faixas claras de autonomia para que os operadores possam resolver problemas rotineiros sem autorização prévia.',
    owner: 'Lideranças & RH',
    days: 45,
    criteria: 'Aumento da agilidade operacional e pontuação de autonomia ≥ 3,6 no próximo ciclo.',
    description: 'Fomento à autonomia técnica e confiança profissional.'
  },
  clareza_decisao: {
    title: 'Descentralização de Alçadas Operacionais',
    category: 'Autonomia & Participação',
    diagnosis: 'Excessiva centralização de decisões na liderança gerando estrangulamento de processos.',
    measure: 'Transferir autoridade formal de decisão técnica para os níveis executores com diretrizes claras.',
    owner: 'Gerência de Operações',
    days: 30,
    criteria: 'Descentralização efetiva de ao menos 3 alçadas rotineiras por equipe.',
    description: 'Empoderamento de equipes técnicas e redução de dependência gerencial.'
  },
  recursos: {
    title: 'Auditoria de Ferramentas, Ergonomia e Infraestrutura (NR-17)',
    category: 'Ergonomia & Recursos (NR-17)',
    diagnosis: 'Ferramentas deficientes, sistemas instáveis ou mobiliário ergonomicamente inadequado gerando estresse.',
    measure: 'Realizar vistoria técnica de postos de trabalho e plano de manutenção/atualização de equipamentos e sistemas.',
    owner: 'SESMT & TI / Facilities',
    days: 30,
    criteria: 'Resolução de 100% dos chamados críticos de infraestrutura identificados pela equipe.',
    description: 'Adequação material aos padrões da NR-1 e NR-17.'
  },

  // Liderança e Suporte
  apoio: {
    title: 'Programa de Desenvolvimento de Liderança em Gestão Humanizada e SST',
    category: 'Liderança & Suporte',
    diagnosis: 'Sensação de isolamento e falta de respaldo da gestão diante de dificuldades operacionais.',
    measure: 'Capacitar líderes de equipe em escuta empática, identificação de riscos psicossociais e apoio prático aos liderados.',
    owner: 'RH & SESMT',
    days: 45,
    criteria: 'Participação de 90%+ das lideranças e evolução positiva nos índices de apoio.',
    description: 'Formação continuada da liderança com foco na integridade biopsicossocial.'
  },
  apoio_gestao: {
    title: 'Plantão de Suporte Gerencial & Rondas de Diálogo com a Equipe',
    category: 'Liderança & Suporte',
    diagnosis: 'Distanciamento entre a chefia imediata e as dificuldades práticas vivenciadas pela base.',
    measure: 'Instituir rodadas quinzenais de diálogo aberto com a liderança para remoção imediata de gargalos.',
    owner: 'Liderança Imediata & RH',
    days: 30,
    criteria: 'Realização regular de reuniões de suporte com ata de encaminhamentos.',
    description: 'Aproximação ativa e resolutiva da liderança em relação às demandas do time.'
  },
  suporte_gestor: {
    title: 'Acompanhamento Proativo de Desafios Operacionais pela Gestão',
    category: 'Liderança & Suporte',
    diagnosis: 'Gestão imediata atua apenas na cobrança de resultados sem agir na remoção de impedimentos.',
    measure: 'Implantar checklist de acompanhamento onde o gestor assume formalmente a resolução de bloqueios do time.',
    owner: 'Diretoria de Operações & RH',
    days: 30,
    criteria: 'Tempo médio de resolução de bloqueios operacionais reduzido em 50%.',
    description: 'Atuação da liderança como facilitadora técnica e protetora da saúde ocupacional.'
  },
  escuta_ativa: {
    title: 'Canais Seguros de Diálogo e Escuta Contínua com a Liderança',
    category: 'Clima & Cultura',
    diagnosis: 'Receio dos colaboradores em expor sobrecargas e problemas por medo de retaliação ou julgamento.',
    measure: 'Instituir sessões de 1-on-1 com roteiro estruturado para acolhimento de feedbacks e dificuldades sem punição.',
    owner: 'RH & Lideranças',
    days: 30,
    criteria: '100% dos colaboradores com reuniões individuais de escuta registradas no mês.',
    description: 'Abertura para diálogo seguro entre líderes e liderados conforme NR-1.'
  },
  justica_procedimental: {
    title: 'Política Transparente de Reconhecimento e Distribuição de Atividades',
    category: 'Justiça Organizacional',
    diagnosis: 'Percepção de favorecimento e falta de transparência na distribuição de tarefas e oportunidades.',
    measure: 'Publicar critérios objetivos e públicos para distribuição de escala, tarefas nobres e bonificações.',
    owner: 'Diretoria & RH',
    days: 45,
    criteria: 'Critérios divulgados formalmente a todas as equipes envolvidas.',
    description: 'Garantia de equidade procedimental e transparência na gestão de pessoas.'
  },
  reconhecimento: {
    title: 'Programa de Valorização Profissional e Reconhecimento de Contribuições',
    category: 'Cultura & Engajamento',
    diagnosis: 'Sensação de invisibilidade e falta de valorização do esforço e empenho técnico dos colaboradores.',
    measure: 'Criar rituais públicos e sistemáticos de agradecimento e reconhecimento de entregas excepcionais.',
    owner: 'RH & Liderança Direta',
    days: 30,
    criteria: 'Prática quinzenal de reconhecimento documentada em reuniões de área.',
    description: 'Reforço positivo e valorização da dedicação profissional dos trabalhadores.'
  },
  valorizacao: {
    title: 'Plano Estruturado de Elogios e Premiação Não Financeira',
    category: 'Cultura & Engajamento',
    diagnosis: 'Ausência crônica de feedback positivo minando o engajamento e a autoeficácia.',
    measure: 'Treinar gestores na formulação de feedbacks específicos de mérito e criar mural digital de conquistas da equipe.',
    owner: 'Comunicação Interna & RH',
    days: 30,
    criteria: 'Aumento expressivo no índice de satisfação com reconhecimento.',
    description: 'Fortalecimento da autoestima profissional e do sentimento de pertencimento.'
  },
  cooperacao: {
    title: 'Dinâmicas de Fortalecimento de Equipe e Eliminação de Silos',
    category: 'Clima & Cooperação',
    diagnosis: 'Competitividade predatória ou desarticulação interna impedindo a colaboração mútua.',
    measure: 'Realizar workshops de alinhamento cooperativo e estabelecer metas coletivas para os times.',
    owner: 'RH & Gestores de Área',
    days: 30,
    criteria: 'Aumento da percepção de cooperação entre pares para faixa adequada (≥ 3,6).',
    description: 'Construção de cultura colaborativa e apoio mútuo nas rotinas de trabalho.'
  },
  colegas: {
    title: 'Criação de Redes de Ajuda Mútua e Pareamento Técnico',
    category: 'Clima & Cooperação',
    diagnosis: 'Trabalhadores isolados enfrentando dificuldades sem poder contar com auxílio dos pares.',
    measure: 'Implantar o modelo de duplas de trabalho (pareamento) para atividades críticas e integração de novos membros.',
    owner: 'Gestão Operacional',
    days: 20,
    criteria: '100% das atividades críticas com suporte cruzado entre colegas.',
    description: 'Fortalecimento das relações horizontais de trabalho e compartilhamento de conhecimento.'
  },

  // Segurança Psicológica
  expressao_segura: {
    title: 'Protocolo de Segurança Psicológica e Estímulo à Voz Divergente',
    category: 'Segurança Psicológica (Edmondson)',
    diagnosis: 'Medo generalizado de expor erros, dúvidas ou discordâncias por receio de retaliação.',
    measure: 'Sessões de liderança para desmistificar o erro como aprendizado e adoção de reuniões de retrospectiva sem culpa (blameless post-mortem).',
    owner: 'Diretoria & RH',
    days: 45,
    criteria: 'Realização de retrospectivas sem culpa e score de segurança psicológica ≥ 3,8.',
    description: 'Instituição de ambiente psicologicamente seguro baseado no modelo de Amy Edmondson.'
  },
  aceitacao_erros: {
    title: 'Procedimento Blameless Post-Mortem para Melhoria Contínua de Processos',
    category: 'Segurança Psicológica (Edmondson)',
    diagnosis: 'Cultura punitiva que busca culpados em vez de corrigir causas-raiz das falhas operacionais.',
    measure: 'Formalizar diretriz corporativa de análise de incidentes com foco em processos e sistemas, nunca na punição de indivíduos.',
    owner: 'Qualidade, SESMT & RH',
    days: 30,
    criteria: 'Adoção formal da ata de aprendizado em todos os incidentes operacionais.',
    description: 'Superação da cultura punitiva e fortalecimento da resiliência organizacional.'
  },

  // Assédio, Respeito e Lei 14.457/22
  respeito: {
    title: 'Código de Conduta & Campanha Permanente de Civilidade no Trabalho',
    category: 'Compliance & Lei 14.457/22 (CIPA)',
    diagnosis: 'Interações com rispidez, condutas desrespeitosas ou atritos recorrentes no ambiente.',
    measure: 'Revisar o código de ética da empresa, realizar rodas de conversa sobre civilidade e reforçar limites de tolerância zero a ofensas.',
    owner: 'Comitê de Ética & CIPA',
    days: 30,
    criteria: 'Divulgação do código a 100% dos empregados com termo de ciência assinado.',
    description: 'Medida obrigatória de proteção ao ambiente de trabalho conforme Lei 14.457/22.'
  },
  relacoes: {
    title: 'Mediação Conflitual e Auditoria de Clima Interpessoal',
    category: 'Compliance & Lei 14.457/22 (CIPA)',
    diagnosis: 'Atritos crônicos e animosidade entre colaboradores prejudicando o bem-estar coletivo.',
    measure: 'Oferecer mediação profissional de conflitos e intervenção focada no reestabelecimento de relações profissionais saudáveis.',
    owner: 'RH & Consultoria Externa',
    days: 30,
    criteria: 'Resolução documentada dos conflitos interpessoais mapeados.',
    description: 'Prevenção de escalada de conflitos para episódios de assédio moral.'
  },
  tratamento_digno: {
    title: 'Treinamento Obrigatório sobre Relações Interpessoais Saudáveis',
    category: 'Compliance & Lei 14.457/22 (CIPA)',
    diagnosis: 'Comportamentos rudes e falta de empatia no cotidiano operacional.',
    measure: 'Capacitar todos os colaboradores em comunicação assertiva não-violenta e respeito à diversidade.',
    owner: 'RH & CIPA',
    days: 45,
    criteria: '95%+ de presença comprovada em lista de treinamento.',
    description: 'Sensibilização preventiva para eliminação de condutas desrespeitosas.'
  },
  prevencao_moral: {
    title: 'Protocolo de Prevenção e Combate ao Assédio Moral Organizacional',
    category: 'Compliance & Lei 14.457/22 (CIPA)',
    diagnosis: 'Indícios de práticas de isolamento, cobranças vexatórias ou perseguição moral.',
    measure: 'Emitir ordem de serviço com diretrizes estritas contra práticas abusivas e instituir processo apuratório célere e sigiloso.',
    owner: 'Jurídico, RH & CIPA',
    days: 30,
    criteria: 'Norma interna aprovada pela diretoria e registrada junto à CIPA.',
    description: 'Atendimento aos requisitos legais da Lei 14.457/22 e NR-1.'
  },
  prevencao_sexual: {
    title: 'Programa Especial de Prevenção ao Assédio Sexual & Violência no Trabalho',
    category: 'Compliance & Lei 14.457/22 (CIPA)',
    diagnosis: 'Vulnerabilidade a condutas inadequadas ou comentários machistas/sexualizados.',
    measure: 'Realizar campanha específica com palestras anuais obrigatórias sobre consentimento, assédio sexual e acolhimento de vítimas.',
    owner: 'CIPA & Comitê de Diversidade',
    days: 30,
    criteria: 'Cumprimento integral da capacitação anual exigida pelo art. 23 da Lei 14.457/22.',
    description: 'Conformidade legal mandatória e garantia de ambiente seguro para todos.'
  },
  conhecimento_canal: {
    title: 'Ampla Divulgação e Desmistificação do Canal de Denúncias',
    category: 'Compliance & Governança',
    diagnosis: 'Desconhecimento dos empregados sobre onde e como relatar irregularidades ou assédio.',
    measure: 'Fixar cartazes nos locais de trabalho, enviar comunicados com link direto e QR Code para acesso ao canal de denúncias seguro.',
    owner: 'Comunicação Interna, Compliance & CIPA',
    days: 15,
    criteria: '100% dos colaboradores cientes dos canais de relato protegidos.',
    description: 'Atendimento aos requisitos de transparência e acesso fácil ao canal ético.'
  },
  confianca_antirretaliacao: {
    title: 'Garantia Institucional de Não Retaliação e Auditoria do Canal de Denúncias',
    category: 'Compliance & Governança',
    diagnosis: 'Medo de retaliação impedindo que colaboradores relatem desvios graves de conduta.',
    measure: 'Publicar termo solene da alta direção garantindo imunidade e sigilo absoluto ao relator de boa-fé.',
    owner: 'Presidência, Ouvidoria & CIPA',
    days: 20,
    criteria: 'Termo assinado e auditado pelo comitê de conformidade.',
    description: 'Pilar basilar de proteção e integridade para eficácia da Lei 14.457/22.'
  },

  // Burnout, Jornada e Descanso
  descanso: {
    title: 'Política de Desconexão Digital & Respeito aos Intervalos Interjornada',
    category: 'Saúde Ocupacional & Burnout',
    diagnosis: 'Contato fora do horário de trabalho invadindo o descanso e impedindo a recuperação biológica.',
    measure: 'Desativar notificações de e-mail e mensagens fora do expediente e fiscalizar rigorosamente intervalos de 11 horas interjornadas.',
    owner: 'RH & Departamento Pessoal',
    days: 15,
    criteria: 'Zero registros de mensagens oficiais fora do horário de trabalho.',
    description: 'Proteção à higidez mental e ao direito à desconexão (NR-1 / CLT).'
  },
  energia_vital: {
    title: 'Programa de Prevenção à Síndrome de Burnout & Triagem Previdenciária',
    category: 'Saúde Ocupacional & Burnout',
    diagnosis: 'Níveis críticos de exaustão física e emocional com risco iminente de afastamento médico (NTEP).',
    measure: 'Realizar triagem clínica com médico do trabalho/psicólogo ocupacional e readequar carga dos colaboradores em risco.',
    owner: 'SESMT (Médico do Trabalho) & RH',
    days: 30,
    criteria: 'Atendimento médico preventivo e redução dos indicadores de fadiga crônica.',
    description: 'Prevenção de passivos previdenciários (FAP) e salvaguarda da saúde mental.'
  },
  recuperacao_sono: {
    title: 'Campanha de Higiene do Sono e Prevenção do Estresse Crônico',
    category: 'Saúde Ocupacional & Burnout',
    diagnosis: 'Alterações no padrão de sono causadas por preocupações e ansiedade relacionadas ao trabalho.',
    measure: 'Disponibilizar material de orientação sobre higiene do sono e flexibilizar horários para colaboradores em recuperação.',
    owner: 'SESMT & Saúde Corporativa',
    days: 30,
    criteria: 'Melhora relatada nos níveis de disposição física e mental nas jornadas.',
    description: 'Intervenção preventiva em fatores de vulnerabilidade ao esgotamento.'
  },

  // Mudanças e Transições
  mudancas: {
    title: 'Plano Estruturado de Comunicação e Gestão de Mudanças Organizacionais',
    category: 'Gestão de Mudanças',
    diagnosis: 'Mudanças repentinas sem aviso prévio gerando insegurança, resistência e estresse coletivo.',
    measure: 'Instituir comitê de transição com cronograma de comunicação antecipada de pelo menos 15 dias antes de qualquer mudança estrutural.',
    owner: 'Gestão de Mudanças & RH',
    days: 30,
    criteria: 'Comunicação prévia formal em 100% das transições e novos processos.',
    description: 'Mitigação do estresse adaptativo através da previsibilidade e transparência.'
  },
  comunicacao_previa: {
    title: 'Rituais de Alinhamento Antecipado de Mudanças e Impactos Operacionais',
    category: 'Gestão de Mudanças',
    diagnosis: 'Informações sobre mudanças chegam por boatos ou no último minuto à equipe de operação.',
    measure: 'Realizar reuniões de alinhamento com apresentação clara do plano de transição antes da entrada em vigor.',
    owner: 'Liderança Direta & Comunicação',
    days: 20,
    criteria: 'Apresentação formal prévia e canal para tirar dúvidas dos trabalhadores.',
    description: 'Transparência ativa para eliminação de incertezas operacionais.'
  },
  treinamento_adaptacao: {
    title: 'Programa de Capacitação e Curva de Aprendizado para Novas Ferramentas',
    category: 'Gestão de Mudanças',
    diagnosis: 'Implantação de novos sistemas ou processos sem treinamento adequado, gerando frustração e sobrecarga.',
    measure: 'Garantir período de transição com tolerância a metas e treinamento intensivo antes da cobrança de resultados.',
    owner: 'T&D, TI & Gestores de Área',
    days: 30,
    criteria: '100% da equipe capacitada e avaliada positivamente na nova ferramenta.',
    description: 'Adaptação técnica humanizada conforme diretrizes de ergonomia cognitiva.'
  },

  // Eficácia das Medidas Preventivas
  conhecimento_plano: {
    title: 'Campanha de Transparência do Inventário de Riscos e Ações do PGR',
    category: 'Auditoria PGR (NR-1)',
    diagnosis: 'Colaboradores desconhecem as ações de prevenção adotadas pela empresa para a saúde psicossocial.',
    measure: 'Apresentar os resultados das pesquisas e as medidas implantadas em murais, intranet e atas da CIPA.',
    owner: 'SESMT, CIPA & RH',
    days: 20,
    criteria: 'Divulgação oficial comprovada com evidência anexada ao prontuário do PGR.',
    description: 'Cumprimento do dever legal de informação aos trabalhadores (NR-1, item 1.4.1).'
  },
  aplicacao_real: {
    title: 'Auditoria de Campo da Aplicação das Medidas Preventivas NR-1',
    category: 'Auditoria PGR (NR-1)',
    diagnosis: 'Medidas preventivas planejadas no papel não estão sendo cumpridas no cotidiano dos postos de trabalho.',
    measure: 'Realizar visitas técnicas e inspeções in loco para verificar se as rotinas de proteção e pausas estão ativas.',
    owner: 'Engenheiro de Segurança / Técnico de SST & CIPA',
    days: 30,
    criteria: 'Relatório de auditoria de campo atestando eficácia prática das medidas.',
    description: 'Controle contínuo do ciclo de melhoria exigido pelo GRO/PGR.'
  },
  canal_feedback_nr1: {
    title: 'Canal Aberto para Ajuste Rápido de Medidas Ineficazes do Plano de Ação',
    category: 'Auditoria PGR (NR-1)',
    diagnosis: 'Trabalhadores encontram dificuldades em apontar falhas nas medidas adotadas pela empresa.',
    measure: 'Criar formulário simples e direto para que qualquer empregado aponte gargalos em medidas preventivas em curso.',
    owner: 'SESMT & CIPA',
    days: 15,
    criteria: 'Canal ativo com prazo máximo de resposta de 5 dias úteis.',
    description: 'Retroalimentação contínua do inventário de riscos psicossociais da NR-1.'
  },
  recuperacao_jornada: {
    title: 'Política de Desconexão e Gestão do Descanso Pós-Jornada',
    category: 'Jornada & Recuperação (NR-1 / NR-17)',
    diagnosis: 'Colaboradores com dificuldade em se desconectar das demandas e restaurar a energia vital fora do expediente.',
    measure: 'Implantar diretrizes claras de desconexão pós-expediente, limitar envio de comunicações fora do horário e reforçar pausas.',
    owner: 'RH & Lideranças',
    days: 30,
    criteria: 'Média do fator acima de 3,6 no ciclo seguinte e cessação de cobranças fora do horário.',
    description: 'Ação preventiva para evitar fadiga crônica e garantir recuperação biológica e psicológica.'
  },
  integridade_coletiva: {
    title: 'Fortalecimento da Confiança Mútua e Alinhamento de Equipe',
    category: 'Segurança Psicológica & Cultura',
    diagnosis: 'Insegurança em relação às atitudes dos colegas de time e receio de comprometimento do próprio trabalho.',
    measure: 'Realizar workshops de alinhamento de papéis, pactuação de metas compartilhadas e dinâmicas de confiança mútua.',
    owner: 'Liderança de Equipe & RH',
    days: 30,
    criteria: 'Ambiente seguro e colaborativo com melhora significativa na percepção de cooperação.',
    description: 'Mitigação de ruídos interpessoais e fomento à segurança psicológica coletiva.'
  },
  distanciamento_cinico: {
    title: 'Prevenção ao Cinismo e Desengajamento Ocupacional',
    category: 'Saúde Mental & Prevenção ao Burnout',
    diagnosis: 'Percepção de indiferença, distanciamento emocional ou cinismo em relação às entregas e colegas de trabalho.',
    measure: 'Conduzir sessões de escuta protegida, reconectar o propósito das tarefas aos objetivos da empresa e avaliar sobrecarga associada.',
    owner: 'Gestão de Pessoas & Lideranças',
    days: 45,
    criteria: 'Resgate do sentimento de pertencimento e redução de indicadores de esgotamento.',
    description: 'Intervenção preventiva voltada à segunda dimensão do modelo de Burnout (Maslach).'
  }
};

/**
 * Retorna as melhores soluções técnicas recomendadas para um fator psicossocial
 */
export function getSolutionsForFactor(factorKey) {
  if (SOLUTIONS_MAP[factorKey]) {
    return [SOLUTIONS_MAP[factorKey]];
  }

  // Tentar casamento por prefixo ou palavras-chave
  const key = String(factorKey).toLowerCase();
  for (const [k, sol] of Object.entries(SOLUTIONS_MAP)) {
    if (key.includes(k) || k.includes(key)) {
      return [sol];
    }
  }

  // Fallback padrão de melhoria NR-1
  return [{
    title: `Plano de Intervenção Preventiva no Fator: ${factorKey}`,
    category: 'Gestão de Riscos (NR-1)',
    diagnosis: 'Fator identificado na faixa de atenção/cuidado durante o ciclo de escuta psicossocial.',
    measure: 'Constituir grupo de trabalho com RH, liderança e CIPA para investigar as causas específicas e estabelecer plano corretivo.',
    owner: 'RH & SESMT',
    days: 30,
    criteria: 'Revisão das causas-raiz e evolução da percepção coletiva no ciclo seguinte.',
    description: 'Ação preventiva padrão estruturada para conformidade contínua com a NR-1.'
  }];
}

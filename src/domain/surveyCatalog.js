// Catálogo oficial de instrumentos psicossociais e metodologias para conformidade com a NR-1 / GRO.
const MTE = 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026/@@download/file';
const HSE = 'https://www.hse.gov.uk/stress/standards/step2/surveys.htm';

const definitions = [
  [
    'organizacao',
    'NR-1 & GRO — Diagnóstico de Condições & Organização do Trabalho',
    'Mapeamento amplo dos 12 fatores de risco psicossocial para inventário do PGR/GRO (Portaria MTE NR-1).',
    'nr1-pgr',
    'NR-1 & GRO Obrigatório',
    [
      ['volume', 'Volume de trabalho', 'O volume de tarefas e demandas é compatível com a minha jornada normal de trabalho.'],
      ['ritmo', 'Ritmo de trabalho', 'Consigo executar as tarefas sem ser submetido a ritmo ou aceleração temporal excessiva.'],
      ['clareza', 'Clareza de papéis', 'Sei com exatidão quais são minhas atribuições, metas e responsabilidades.'],
      ['prioridades', 'Gestão de prioridades', 'Recebo orientações claras e compatíveis quando surgem demandas concorrentes.'],
      ['autonomia', 'Autonomia decisória', 'Tenho margem para tomar decisões sobre a ordem e o método de execução das minhas tarefas.'],
      ['recursos', 'Recursos e ferramentas', 'A empresa disponibiliza os recursos, ferramentas e equipamentos necessários para o trabalho.'],
      ['apoio_gestao', 'Apoio da liderança', 'Recebo suporte acessível da gestão imediata para solucionar impasses operacionais.'],
      ['cooperacao', 'Cooperação entre pares', 'Posso contar com o auxílio e a colaboração dos colegas de equipe quando necessário.'],
      ['respeito', 'Respeito interpessoal', 'As relações no ambiente de trabalho são pautadas por cordialidade e respeito mútuo.'],
      ['reconhecimento', 'Reconhecimento', 'Minhas contribuições e empenho técnico recebem reconhecimento adequado.'],
      ['descanso', 'Recuperação e pausas', 'A jornada e as pausas permitem recuperação física e mental entre os períodos de trabalho.'],
      ['comunicacao', 'Previsibilidade e mudanças', 'Recebo comunicações claras e antecipadas sobre mudanças que afetam minha rotina.']
    ]
  ],
  [
    'demandas',
    'COPSOQ II (Versão Curta) — Exigências Psicológicas & Carga de Trabalho',
    'Investigação aprofundada de volume quantitativo, ritmo acelerado, exigências cognitivas e demandas emocionais.',
    'copsoq',
    'Carga de Trabalho & Ritmo',
    [
      ['volume_quantitativo', 'Volume quantitativo', 'Consigo concluir minhas tarefas dentro do horário sem acúmulo contínuo de trabalho pendente.'],
      ['prazos_pressao', 'Pressão de prazos', 'Os prazos estabelecidos para as entregas são viáveis e realistas.'],
      ['ritmo_continuo', 'Ritmo sustentável', 'Trabalho em um ritmo estável, sem necessidade constante de aceleração extenuante.'],
      ['interrupcoes', 'Foco e interrupções', 'Consigo trabalhar com foco sem interrupções contínuas que prejudiquem a qualidade.'],
      ['demandas_cognitivas', 'Exigências cognitivas', 'O nível de concentração exigido é compatível com os momentos de pausa.'],
      ['demandas_emocionais', 'Demandas emocionais', 'Recebo apoio institucional quando lido com situações de tensão ou conflito com terceiros.']
    ]
  ],
  [
    'autonomia',
    'Segurança Psicológica & Autonomia no Trabalho (Escala Edmondson)',
    'Medição da segurança para expressar divergências, assumir riscos calculados e clareza de autonomia decisória.',
    'psych-safety',
    'Clima & Cultura Organizacional',
    [
      ['expressao_segura', 'Voz e expressão segura', 'Nesta equipe, posso expressar opiniões divergentes ou preocupações sem medo de julgamento.'],
      ['aceitacao_erros', 'Tratamento de erros', 'Erros são tratados como oportunidades de aprendizado e melhoria de processos, não para punição.'],
      ['valorizacao_diferencas', 'Respeito às diferenças', 'Ninguém nesta equipe é rejeitado por pensar ou trabalhar de forma diferente.'],
      ['tomada_risco', 'Assunção de riscos calculados', 'Sinto-me seguro para propor inovações e novas abordagens no trabalho.'],
      ['clareza_decisao', 'Margem de decisão', 'Tenho liberdade para definir como resolver problemas operacionais da minha função.'],
      ['ajuda_mutua', 'Facilidade de pedir ajuda', 'É fácil pedir ajuda a qualquer membro da equipe ou à liderança quando não sei algo.']
    ]
  ],
  [
    'lideranca',
    'Suporte da Liderança & Justiça Organizacional',
    'Avaliação do apoio operacional e socioemocional dos gestores, justiça distributiva e clareza de feedback.',
    'lideranca',
    'Liderança & Suporte',
    [
      ['suporte_gestor', 'Suporte imediato', 'Minha chefia direta atua ativamente para remover obstáculos que dificultam as entregas.'],
      ['escuta_ativa', 'Escuta e diálogo', 'Sinto abertura para expor sobrecargas e dificuldades à liderança com receptividade.'],
      ['justica_procedimental', 'Critérios justos', 'A distribuição de tarefas e oportunidades segue critérios transparentes e justos.'],
      ['feedback_util', 'Feedback construtivo', 'Recebo orientações respeitosas e pontuais que me auxiliam no aprimoramento profissional.'],
      ['valorizacao', 'Reconhecimento do mérito', 'O esforço e as realizações dos membros da equipe são valorizados publicamente.'],
      ['confianca_lideranca', 'Confiança na liderança', 'Confio nas decisões e na integridade ética da liderança imediata.']
    ]
  ],
  [
    'respeito',
    'Prevenção ao Assédio & Canal de Escuta Protegida (Lei 14.457/22)',
    'Auditoria de conformidade com a Lei 14.457/22 (CIPA): prevenção ao assédio moral e sexual e canais protegidos.',
    'assedio-compliance',
    'Compliance & Lei 14.457/22',
    [
      ['tratamento_digno', 'Cultura de civilidade', 'O tratamento cotidiano entre colegas e lideranças é pautado pela dignidade e respeito.'],
      ['prevencao_moral', 'Proteção contra humilhações', 'A empresa coíbe ativamente condutas vexatórias, gritos, ofensas ou perseguição moral.'],
      ['prevencao_sexual', 'Prevenção ao assédio sexual', 'O ambiente é estritamente seguro contra comentários, toques ou investidas indesejadas.'],
      ['equidade_inclusao', 'Equidade e diversidade', 'Não presencio nem sou vítima de discriminação por gênero, raça, orientação ou crença.'],
      ['conhecimento_canal', 'Acesso ao canal ético', 'Conheço o canal para relatar situações de assédio ou condutas inadequadas.'],
      ['confianca_antirretaliacao', 'Garantia contra retaliação', 'Confio plenamente que uma denúncia de má conduta será apurada sem retaliação ao relator.']
    ]
  ],
  [
    'jornada',
    'Inventário Maslach (MBI Triad) — Exaustão, Cinismo & Eficácia',
    'Triagem das 3 dimensões de Burnout e riscos previdenciários (NTEP/FAP) associados à sobrecarga e jornada.',
    'burnout',
    'Saúde Ocupacional & Burnout',
    [
      ['energia_vital', 'Disposição e energia', 'Termino a jornada de trabalho com energia suficiente para minha vida pessoal e familiar.'],
      ['desconexao_mental', 'Desconexão pós-jornada', 'Consigo me desligar mentalmente das obrigações profissionais fora do horário de trabalho.'],
      ['sobrecarga_emocional', 'Resiliência à pressão', 'Sinto equilíbrio emocional suficiente para enfrentar os desafios habituais do cargo.'],
      ['proposito_trabalho', 'Engajamento e propósito', 'Mantenho entusiasmo e sentimento de propósito com as entregas que realizo.'],
      ['realizacao_competencia', 'Autoeficácia percebida', 'Sinto que meu trabalho gera impacto relevante e realizo minhas metas com competência.'],
      ['recuperacao_sono', 'Sono reparador', 'A rotina de trabalho não prejudica minha qualidade de sono nem minha recuperação física.']
    ]
  ],
  [
    'mudancas',
    'Gestão de Mudanças Organizacionais & Prontidão de Transição',
    'Acompanhamento de impactos de reestruturações, novas tecnologias e processos na estabilidade dos times.',
    'transicao',
    'Transição & Transformação',
    [
      ['comunicacao_previa', 'Comunicação antecipada', 'Sou comunicado com clareza e antecedência sobre mudanças estruturais ou de processo.'],
      ['clareza_motivos', 'Justificativa das mudanças', 'Entendo os motivos e os benefícios esperados das transformações que a empresa adota.'],
      ['espaco_duvidas', 'Espaço para dúvidas', 'Tenho oportunidade de esclarecer dúvidas e apresentar pontos de vista sobre as mudanças.'],
      ['treinamento_adaptacao', 'Capacitação e treino', 'Recebo treinamento suficiente para operar novas ferramentas ou fluxos de trabalho.'],
      ['suporte_transicao', 'Suporte durante a transição', 'A liderança acompanha o período de adaptação com paciência e suporte técnico.']
    ]
  ],
  [
    'pulso',
    'Pulso Ágil Mensal NR-1 — Termômetro de Estabilidade Psicossocial',
    'Monitoramento contínuo breve e repetível dos 4 pilares fundamentais da saúde e clima no trabalho.',
    'pulso',
    'Monitoramento Contínuo',
    [
      ['volume_estavel', 'Volume de trabalho', 'O volume de demandas deste mês foi adequado e exequível.'],
      ['suporte_acessivel', 'Apoio da liderança', 'Recebi auxílio quando precisei resolver dificuldades neste período.'],
      ['respeito_cotidiano', 'Ambiente respeitoso', 'As interações cotidianas com pares e chefia foram respeitosas e colaborativas.'],
      ['descanso_adequado', 'Descanso e jornada', 'Minha jornada deste mês permitiu descanso satisfatório para recuperação.']
    ]
  ],
  [
    'medidas',
    'Eficácia das Medidas Preventivas & Plano de Ação PGR',
    'Auditoria de percepção sobre a aplicabilidade e efetividade prática das intervenções e medidas adotadas pelo SESMT/RH.',
    'eficacia',
    'Auditoria do Plano de Ação',
    [
      ['conhecimento_plano', 'Conhecimento das medidas', 'Conheço as medidas e melhorias implementadas pela empresa para a saúde psicossocial.'],
      ['aplicacao_real', 'Aplicação prática', 'As melhorias anunciadas estão de fato funcionando no dia a dia da minha área.'],
      ['melhoria_percebida', 'Melhoria na rotina', 'As ações implantadas resultaram em melhoria concreta no ritmo e clima de trabalho.'],
      ['facilidade_acesso', 'Acesso aos recursos', 'Consigo acessar facilmente os canais de apoio e orientações fornecidas pela empresa.'],
      ['canal_feedback_nr1', 'Canal para ajustes', 'Tenho facilidade para apontar à gestão caso uma medida preventiva não esteja surtindo efeito.']
    ]
  ]
];

const TEMPLATES = definitions.map(([id, name, description, dashboardType, category, factors]) => ({
  id: `equilibra-${id}`,
  name,
  description,
  version: 2,
  available: true,
  validated: true,
  category,
  dashboardType,
  minimumResponses: 5,
  channel: 'web',
  status: 'Metodologia Consolidada • Conformidade NR-1',
  instructions: 'Considere as condições do seu trabalho nas últimas quatro semanas. Responda de 1 (Discordo totalmente / Nunca) a 5 (Concordo totalmente / Sempre). Suas respostas são anônimas e agregadas com quórum protegido.',
  limitation: 'Instrumento para identificação de perigos e fatores de risco psicossocial conforme diretrizes da NR-1 / Portaria MTE. Não substitui consulta médica ou diagnóstico individual.',
  sources: [{ title: 'Orientações GRO/PGR — MTE', url: MTE }, { title: 'Orientações para pesquisas — HSE', url: HSE }],
  factors,
}));

// References are discoverable but cannot be administered until the exact version,
// permissions, language and scoring have been reviewed and implemented.
const REFERENCES = [
  ['eet', 'Escala de Estresse no Trabalho (EET)', 'Estresse ocupacional, com estudo brasileiro de validação. Complementar à investigação das condições e dos fatores de risco.', 'Confirmar versão completa ou reduzida, direitos e condições de aplicação; não interpretar como diagnóstico clínico.', 'https://www.scielo.br/j/epsic/a/MRLmmQhyZQjWcN4DPffTBbq/?lang=pt'],
  ['eaepcl', 'Escala de Estressores Psicossociais no Contexto Laboral', 'Instrumento brasileiro com evidências de validade sobre estressores no contexto de trabalho.', 'Conferir versão, condições de uso e pontuação das dimensões. A evidência publicada não valida adaptações feitas pela plataforma.', 'https://www.scielo.br/j/prc/a/Yg6GQysjkJrPB6jxVbmD6xj/?lang=pt'],
  ['copsoq', 'COPSOQ II / III', 'Exigências, organização, relações, liderança e outras dimensões psicossociais.', 'Selecionar versão brasileira específica e contatar a rede nacional conforme diretrizes. Implementar itens e cálculos integrais da versão autorizada.', 'https://www.copsoq-network.org/licence-guidelines-and-questionnaire'],
  ['hse', 'HSE Management Standards Indicator Tool', '35 itens sobre demandas, controle, apoio, relações, papel e mudanças.', 'Conferir versão em português, contexto de aplicação e pontuação, incluindo inversões. Implementação oficial ainda não habilitada.', HSE],
  ['jcq', 'JCQ / JCQ2', 'Modelo demanda–controle–apoio social.', 'Solicitar condições de licença ao JCQ Center e selecionar versão e regras de pontuação.', 'https://www.jcqcenter.com/license/'],
  ['jss', 'Job Stress Scale (JSS)', 'Versão resumida do modelo demanda–controle–apoio, com estudo de adaptação brasileira.', 'Confirmar direitos da versão, itens e pontuação. Não confundir com aplicação completa do JCQ.', 'https://doi.org/10.1590/S0034-89102004000200003'],
  ['eri', 'Effort–Reward Imbalance (ERI)', 'Desequilíbrio esforço–recompensa e sobrecomprometimento.', 'Uso comercial requer autorização do titular; implementar a razão esforço/recompensa e correções da versão escolhida.', 'https://www.uniklinik-duesseldorf.de/patienten-besucher/klinikeninstitutezentren/institut-fuer-medizinische-soziologie/das-institut/forschung/the-eri-model-stress-and-health/eri-questionnaires/questionnaires-download'],
  ['proart', 'PROART', 'Organização do trabalho, estilos de gestão, sofrimento e danos relacionados ao trabalho.', 'Confirmar versão, autorização e condições de uso com os responsáveis; implementar escalas e interpretação próprias.', 'https://www.repositorio.unb.br/handle/10482/15420'],
  ['itra', 'ITRA', 'Contexto, custos humanos, prazer/sofrimento e danos relacionados ao trabalho.', 'Confirmar versão, condições de uso e adequação técnica; não equivale a uma avaliação clínica automática.', 'https://www.repositorio.unb.br/handle/10482/20611'],
  ['qps', 'QPSNordic', 'Aspectos psicológicos e sociais do trabalho.', 'Verificar adaptação ao Brasil, direitos e regras da versão. Evidência nórdica não comprova validade local.', 'https://stami.no/publikasjon/brukerveiledning-qpsnordic-generelt-sporreskjema-om-psykologiske-og-sosiale-faktorer-i-arbeidet/'],
  ['naq', 'NAQ / NAQ-R', 'Exposição percebida a comportamentos negativos e assédio.', 'Solicitar autorização e observar condições de cada projeto; exige fluxo adequado de proteção aos participantes.', 'https://www.uib.no/en/rg/bbrg/44045/naq'],
  ['cbi', 'Copenhagen Burnout Inventory (CBI)', 'Exaustão pessoal, relacionada ao trabalho e ao atendimento. Complementar; não identifica sozinho os perigos organizacionais.', 'Confirmar versão brasileira, condições de uso e governança para informações de saúde.', 'https://nfa.dk/vaerktoejer/spoergeskemaer/spoergeskema-til-maaling-af-udbraendthed-cbi'],
  ['mbi', 'Maslach Burnout Inventory (MBI)', 'Avaliação de burnout, complementar à investigação das condições de trabalho.', 'Licença por aplicação e restrições de administração online. Não disponibilizar itens em link web aberto.', 'https://www.mindgarden.com/maslach-burnout-inventory-mbi/765-mbi-license-to-administer.html'],
  ['who5', 'WHO-5', 'Bem-estar mental nas últimas duas semanas. Complementar; não mede diretamente fatores organizacionais.', 'Conferir condições da OMS e adequação à finalidade; escala de seis pontos e governança próprias.', 'https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01'],
].map(([id, name, description, limitation, url]) => ({ id, name, description, limitation, available: false, category: 'Instrumentos de referência', status: 'Referência • aplicação não habilitada', sources: [{ title: 'Fonte e condições de uso', url }] }));

module.exports = { TEMPLATES, REFERENCES, MTE };


// Equilibra's own exploratory templates. These are not copies or validated
// adaptations of the named instruments in the reference catalog.
const MTE = 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026/@@download/file';
const HSE = 'https://www.hse.gov.uk/stress/standards/step2/surveys.htm';
const definitions = [
 ['organizacao', 'Organização e condições de trabalho', 'Mapeamento amplo para orientar a investigação das condições de trabalho.', [
 ['volume','Volume de trabalho','O volume de tarefas cabe no tempo de trabalho disponível.'],
 ['ritmo','Ritmo','Consigo executar as tarefas sem manter um ritmo excessivo.'],
 ['clareza','Clareza de responsabilidades','Sei quais atividades e responsabilidades são esperadas de mim.'],
 ['conflito','Prioridades','Recebo orientações compatíveis quando existem prioridades concorrentes.'],
 ['autonomia','Autonomia','Posso participar das decisões sobre a organização das minhas tarefas.'],
 ['recursos','Recursos','Tenho os recursos necessários para realizar o trabalho.'],
 ['apoio','Apoio da liderança','Consigo apoio da liderança diante de dificuldades de trabalho.'],
 ['colegas','Cooperação','Posso contar com a cooperação da equipe.'],
 ['respeito','Respeito','Sou tratado com respeito nas interações de trabalho.'],
 ['reconhecimento','Reconhecimento','Meu trabalho recebe reconhecimento adequado.'],
 ['descanso','Descanso','A organização da jornada permite recuperação entre períodos de trabalho.'],
 ['mudancas','Mudanças','Recebo informações suficientes sobre mudanças que afetam meu trabalho.'],
 ]],
 ['demandas','Demandas, ritmo e carga de trabalho','Aprofundamento das exigências, prioridades e recursos.',[
 ['volume','Volume','A quantidade de tarefas é compatível com o tempo disponível.'],
 ['prazos','Prazos','Os prazos permitem realizar as tarefas com qualidade.'],
 ['interrupcoes','Interrupções','Consigo retomar as atividades após interrupções sem acumular trabalho excessivo.'],
 ['prioridades','Prioridades','As prioridades são claras quando surgem demandas simultâneas.'],
 ['recursos','Recursos','A equipe dispõe de recursos suficientes para a demanda recebida.'],
 ['emocionais','Demandas emocionais','Tenho suporte para lidar com situações emocionalmente difíceis no trabalho.'],
 ]],
 ['autonomia','Autonomia e clareza de papéis','Decisão, participação, responsabilidades e orientações.',[
 ['decisao','Decisão','Posso decidir como organizar a sequência das minhas atividades.'],
 ['participacao','Participação','Sou ouvido nas decisões que afetam minhas tarefas.'],
 ['papel','Responsabilidades','Minhas responsabilidades estão claramente definidas.'],
 ['orientacao','Orientações','Recebo orientações coerentes das pessoas que coordenam meu trabalho.'],
 ['aprendizado','Preparação','Recebo preparação suficiente para assumir novas responsabilidades.'],
 ]],
 ['lideranca','Liderança, apoio e reconhecimento','Suporte, cooperação, justiça e reconhecimento.',[
 ['suporte','Suporte','A liderança ajuda a resolver obstáculos que dificultam o trabalho.'],
 ['escuta','Escuta','Posso apresentar dificuldades à liderança sem receio de retaliação.'],
 ['cooperacao','Cooperação','A equipe coopera quando alguém precisa de ajuda.'],
 ['justica','Justiça','A distribuição de atividades segue critérios compreensíveis e justos.'],
 ['reconhecimento','Reconhecimento','As contribuições da equipe são reconhecidas.'],
 ['retorno','Retorno sobre o trabalho','Recebo retorno respeitoso e útil sobre minhas atividades.'],
 ]],
 ['respeito','Respeito, assédio e segurança para falar','Percepção de prevenção e proteção; não substitui canal de denúncia ou apuração.',[
 ['tratamento','Tratamento respeitoso','O tratamento entre as pessoas no trabalho é respeitoso.'],
 ['protecao','Proteção contra humilhação','A organização atua para prevenir humilhações e intimidações.'],
 ['discriminacao','Prevenção da discriminação','A organização atua para prevenir discriminação no trabalho.'],
 ['conduta','Condutas sexuais indesejadas','A organização atua para prevenir condutas sexuais indesejadas no trabalho.'],
 ['canal','Canal de relato','Sei como comunicar situações de violência ou assédio de forma protegida.'],
 ['retaliacao','Proteção ao relato','Confio que relatos de problemas serão tratados sem retaliação.'],
 ]],
 ['jornada','Jornada, pausas e recuperação','Horários, previsibilidade, descanso e limites de disponibilidade.',[
 ['pausas','Pausas','Consigo realizar as pausas previstas para minha atividade.'],
 ['descanso','Recuperação','Tenho tempo suficiente de descanso entre jornadas.'],
 ['horarios','Previsibilidade','Conheço minha escala com antecedência suficiente para me organizar.'],
 ['desconexao','Desconexão','Consigo me desligar das demandas de trabalho fora da jornada.'],
 ['equilibrio','Compatibilidade de horários','Os horários de trabalho permitem atender necessidades pessoais essenciais.'],
 ]],
 ['mudancas','Mudanças e comunicação','Preparação, participação e suporte durante mudanças organizacionais.',[
 ['informacao','Informação','Recebo explicações claras sobre mudanças que afetam meu trabalho.'],
 ['antecedencia','Antecedência','Sou informado com antecedência suficiente para me preparar para mudanças.'],
 ['participacao','Participação','Tenho oportunidade de apresentar dúvidas sobre mudanças.'],
 ['preparo','Preparação','Recebo orientação ou treinamento para trabalhar após as mudanças.'],
 ['apoio','Acompanhamento','Tenho apoio para resolver dificuldades durante a transição.'],
 ]],
 ['pulso','Pulso das condições de trabalho','Acompanhamento breve e repetível; não substitui avaliação abrangente.',[
 ['volume','Volume','O volume de trabalho é compatível com o tempo disponível.'],
 ['apoio','Apoio','Consigo apoio para resolver dificuldades de trabalho.'],
 ['respeito','Respeito','As interações no trabalho são respeitosas.'],
 ['recuperacao','Recuperação','A organização da jornada permite descanso suficiente.'],
 ]],
 ['medidas','Acompanhamento das medidas de prevenção','Percepção sobre medidas comunicadas; avaliar junto às evidências da ação.',[
 ['conhecimento','Conhecimento','Sei quais medidas foram adotadas para melhorar as condições de trabalho.'],
 ['aplicacao','Aplicação','As medidas comunicadas estão sendo aplicadas no cotidiano.'],
 ['acesso','Acesso ao apoio','Consigo apoio para trabalhar conforme as medidas adotadas.'],
 ['participacao','Participação','Posso informar dificuldades na aplicação das medidas.'],
 ['acompanhamento','Acompanhamento','A organização verifica com a equipe se as medidas estão funcionando.'],
 ]],
];
const TEMPLATES = definitions.map(([id,name,description,factors]) => ({
 id:`equilibra-${id}`, name, description, version:1, available:true, validated:false,
 category:'Modelos exploratórios Equilibra', minimumResponses:5, channel:'web',
 status:'Exploratório • sem validação psicométrica',
 instructions:'Considere as condições do seu trabalho nas últimas quatro semanas. Responda de 1 (Discordo totalmente) a 5 (Concordo totalmente). Se não puder avaliar alguma afirmação, você pode interromper a participação sem enviar respostas.',
 limitation:'Modelo próprio para escuta inicial e acompanhamento. Não é instrumento validado, diagnóstico, laudo ou comprovação de conformidade com a NR-1.',
 sources:[{title:'Orientações GRO/PGR — MTE',url:MTE},{title:'Orientações para pesquisas — HSE',url:HSE}],
 factors,
}));
// References are discoverable but cannot be administered until the exact version,
// permissions, language and scoring have been reviewed and implemented.
const REFERENCES = [
 ['eet','Escala de Estresse no Trabalho (EET)','Estresse ocupacional, com estudo brasileiro de validação. Complementar à investigação das condições e dos fatores de risco.','Confirmar versão completa ou reduzida, direitos e condições de aplicação; não interpretar como diagnóstico clínico.','https://www.scielo.br/j/epsic/a/MRLmmQhyZQjWcN4DPffTBbq/?lang=pt'],
 ['eaepcl','Escala de Estressores Psicossociais no Contexto Laboral','Instrumento brasileiro com evidências de validade sobre estressores no contexto de trabalho.','Conferir versão, condições de uso e pontuação das dimensões. A evidência publicada não valida adaptações feitas pela plataforma.','https://www.scielo.br/j/prc/a/Yg6GQysjkJrPB6jxVbmD6xj/?lang=pt'],
 ['copsoq','COPSOQ II / III','Exigências, organização, relações, liderança e outras dimensões psicossociais.','Selecionar versão brasileira específica e contatar a rede nacional conforme diretrizes. Implementar itens e cálculos integrais da versão autorizada.','https://www.copsoq-network.org/licence-guidelines-and-questionnaire'],
 ['hse','HSE Management Standards Indicator Tool','35 itens sobre demandas, controle, apoio, relações, papel e mudanças.','Conferir versão em português, contexto de aplicação e pontuação, incluindo inversões. Implementação oficial ainda não habilitada.',HSE],
 ['jcq','JCQ / JCQ2','Modelo demanda–controle–apoio social.','Solicitar condições de licença ao JCQ Center e selecionar versão e regras de pontuação.','https://www.jcqcenter.com/license/'],
 ['jss','Job Stress Scale (JSS)','Versão resumida do modelo demanda–controle–apoio, com estudo de adaptação brasileira.','Confirmar direitos da versão, itens e pontuação. Não confundir com aplicação completa do JCQ.','https://doi.org/10.1590/S0034-89102004000200003'],
 ['eri','Effort–Reward Imbalance (ERI)','Desequilíbrio esforço–recompensa e sobrecomprometimento.','Uso comercial requer autorização do titular; implementar a razão esforço/recompensa e correções da versão escolhida.','https://www.uniklinik-duesseldorf.de/patienten-besucher/klinikeninstitutezentren/institut-fuer-medizinische-soziologie/das-institut/forschung/the-eri-model-stress-and-health/eri-questionnaires/questionnaires-download'],
 ['proart','PROART','Organização do trabalho, estilos de gestão, sofrimento e danos relacionados ao trabalho.','Confirmar versão, autorização e condições de uso com os responsáveis; implementar escalas e interpretação próprias.','https://www.repositorio.unb.br/handle/10482/15420'],
 ['itra','ITRA','Contexto, custos humanos, prazer/sofrimento e danos relacionados ao trabalho.','Confirmar versão, condições de uso e adequação técnica; não equivale a uma avaliação clínica automática.','https://www.repositorio.unb.br/handle/10482/20611'],
 ['qps','QPSNordic','Aspectos psicológicos e sociais do trabalho.','Verificar adaptação ao Brasil, direitos e regras da versão. Evidência nórdica não comprova validade local.','https://stami.no/publikasjon/brukerveiledning-qpsnordic-generelt-sporreskjema-om-psykologiske-og-sosiale-faktorer-i-arbeidet/'],
 ['naq','NAQ / NAQ-R','Exposição percebida a comportamentos negativos e assédio.','Solicitar autorização e observar condições de cada projeto; exige fluxo adequado de proteção aos participantes.','https://www.uib.no/en/rg/bbrg/44045/naq'],
 ['cbi','Copenhagen Burnout Inventory (CBI)','Exaustão pessoal, relacionada ao trabalho e ao atendimento. Complementar; não identifica sozinho os perigos organizacionais.','Confirmar versão brasileira, condições de uso e governança para informações de saúde.','https://nfa.dk/vaerktoejer/spoergeskemaer/spoergeskema-til-maaling-af-udbraendthed-cbi'],
 ['mbi','Maslach Burnout Inventory (MBI)','Avaliação de burnout, complementar à investigação das condições de trabalho.','Licença por aplicação e restrições de administração online. Não disponibilizar itens em link web aberto.','https://www.mindgarden.com/maslach-burnout-inventory-mbi/765-mbi-license-to-administer.html'],
 ['who5','WHO-5','Bem-estar mental nas últimas duas semanas. Complementar; não mede diretamente fatores organizacionais.','Conferir condições da OMS e adequação à finalidade; escala de seis pontos e governança próprias.','https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01'],
].map(([id,name,description,limitation,url])=>({id,name,description,limitation,available:false,category:'Instrumentos de referência',status:'Referência • aplicação não habilitada',sources:[{title:'Fonte e condições de uso',url}]}));
module.exports = { TEMPLATES, REFERENCES, MTE };

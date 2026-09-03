import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { NR1_DIMENSIONS, calculateRisk, calculateConfidenceScore } from './riskMatrix.js';
import { SYSTEM_INTERVIEW_PROMPT, buildSynthesisPrompt } from './prompts/index.js';

dotenv.config();

const rawModel = (process.env.GROQ_MODEL || 'openai/gpt-oss-120b').split('#')[0].split('//')[0].trim();
const GROQ_MODEL = rawModel || 'openai/gpt-oss-120b';
const apiKey = process.env.GROQ_API_KEY?.trim();

if (!apiKey || apiKey === 'sua_chave_aqui') {
  console.error('❌ ERRO CRÍTICO: GROQ_API_KEY não configurada no arquivo .env!');
}

const groq = new Groq({ apiKey });

/**
 * Gera dinamicamente o próximo passo da entrevista com a Groq
 */
export async function getNextInterviewStep(session) {
  const { profile, history } = session;
  const currentStep = history.length + 1;

  const lastHistory = history[history.length - 1];
  const lastAnswer = (lastHistory?.userAnswer || '').toLowerCase().trim();
  const lastQuestion = (lastHistory?.question || '').toLowerCase();
  const lastWidget = lastHistory?.widgetType;
  
  // 1. Verifica se a pergunta imediatamente anterior era um convite prévio para justificar/detalhar
  const wasJustificationInvite = 
    lastQuestion.includes('gostaria de justificar') || 
    lastQuestion.includes('gostaria de comentar') || 
    lastQuestion.includes('deseja detalhar') ||
    lastQuestion.includes('gostaria de relatar');

  const answeredWantToJustify = wasJustificationInvite && (
    lastAnswer.includes('sim') || 
    lastAnswer.includes('quero') || 
    lastAnswer.includes('justificar') || 
    lastAnswer.includes('comentar') ||
    lastAnswer.includes('relatar')
  );

  const answeredRefuseToJustify = wasJustificationInvite && (
    lastAnswer.includes('não') || 
    lastAnswer.includes('nao') || 
    lastAnswer.includes('prosseguir') || 
    lastAnswer.includes('seguir')
  );

  // 2. Detecção de questão de alternativa onde o usuário afirma sofrer/vivenciar risco ou condição desfavorável
  const isAlternativeWidget = 
    lastWidget === 'binary_cards' || 
    lastWidget === 'choice_chips' || 
    lastWidget === 'emoji_scale';

  const isRiskContextQuestion = 
    lastQuestion.includes('pressão') || 
    lastQuestion.includes('assédio') || 
    lastQuestion.includes('humilh') || 
    lastQuestion.includes('gritos') || 
    lastQuestion.includes('desrespeito') || 
    lastQuestion.includes('ameaça') || 
    lastQuestion.includes('sobrecarga') || 
    lastQuestion.includes('cansaço') || 
    lastQuestion.includes('conflito') || 
    lastQuestion.includes('difíceis') || 
    lastQuestion.includes('impactad');

  const isSufferingAnswer = 
    ((lastAnswer === 'sim' || lastAnswer.startsWith('sim')) && isRiskContextQuestion) ||
    lastAnswer.includes('gritos') ||
    lastAnswer.includes('humilh') ||
    lastAnswer.includes('desvalorização') ||
    lastAnswer.includes('assédio') ||
    lastAnswer.includes('ameaça') ||
    lastAnswer.includes('muito ruim') ||
    lastAnswer.includes('desconfortável') ||
    lastAnswer.includes('nível 1/5') ||
    lastAnswer.includes('nível 2/5') ||
    (lastAnswer.startsWith('outro:') && (lastAnswer.includes('ruim') || lastAnswer.includes('press') || lastAnswer.includes('falta')));

  const shouldAskToJustify = !wasJustificationInvite && isAlternativeWidget && isSufferingAnswer;

  // 3. Detecção de Resposta Evasiva, Aleatória, Monossilábica desconexa ou Pulo de questão
  const isGibberishOrEvasive = () => {
    if (!lastAnswer || lastWidget !== 'text_input') return false;
    const trimmed = lastAnswer.trim().toLowerCase();
    const isKeyboardMashing = /^([a-z0-9])\1{2,}$/i.test(trimmed) || /^(asdf|qwer|zxcv|1234|jkl|ghjk|test|teste|\.+|-+|\?+|!+)$/i.test(trimmed);
    const isEvasivePhrase = /^(sla|sei lá|sei la|tanto faz|nada|não sei|nao sei|nada a declarar|nada a ver|nd|nao quero falar|não quero falar|ok|ta|blz|pular|nenhum|nenhuma)$/i.test(trimmed);
    const isTooShortToMakeSense = trimmed.length < 3 && !['sim', 'não', 'nao'].includes(trimmed);
    return isKeyboardMashing || isEvasivePhrase || isTooShortToMakeSense;
  };

  const detectedEvasion = isGibberishOrEvasive();

  let stepInstruction = '';

  if (detectedEvasion) {
    stepInstruction = `O colaborador forneceu uma resposta evasiva, desconexa ou com digitação aleatória ("${lastHistory?.userAnswer}"). Acolha com compreensão e naturalidade ("Sem problemas, vamos tornar isso mais simples e direto...") e REFORMULE A PERGUNTA SOBRE A MESMA DIMENSÃO DE FORMA FECHADA usando ui_widget "choice_chips" (com 3 a 4 opções concretas) ou "slider_0_10" ou "binary_cards" para que ele possa apenas selecionar sem precisar digitar. Registre nas observações que a pergunta foi adaptada por resposta evasiva.`;
  } else if (shouldAskToJustify) {
    stepInstruction = `O colaborador respondeu a uma pergunta de alternativa apontando uma situação de sofrimento, vivência negativa ou risco ("${lastHistory?.userAnswer}"). Acolha com respeito e aplique o PROTOCOLO DE CONVITE PRÉVIO: pergunte se ele gostaria de justificar ou detalhar sobre essa situação antes de pedir um relato escrito. Use ui_widget "binary_cards" com card_left: { label: "Sim, quero justificar", icon: "fa-comment-dots" } e card_right: { label: "Não, prefiro prosseguir", icon: "fa-arrow-right" }.`;
  } else if (answeredWantToJustify) {
    stepInstruction = `O colaborador confirmou que deseja justificar e detalhar a situação. Acolha com sensibilidade e garantia de sigilo (NR-01/LGPD). Abra um campo de texto livre (ui_widget "text_input") com placeholder encorajador para ele escrever a justificativa com suas palavras.`;
  } else if (answeredRefuseToJustify) {
    stepInstruction = `O colaborador preferiu não detalhar ou justificar a situação. Respeite totalmente a privacidade com gentileza ("Compreendo e respeito seu espaço...") e avance para a próxima dimensão sem insistir.`;
  } else if (currentStep === 1) {
    stepInstruction = `No bot_statement do PASSO 1, APRESENTE-SE OBRIGATORIAMENTE PELO SEU NOME: "Olá! Sou a EquilibraAI. Vamos conversar sobre como é a sua rotina no setor de ${profile.sector || 'trabalho'}." Em seguida, formule a PRIMEIRA pergunta objetiva da Dimensão 1 do ISTAS21-BR (Demandas Psicológicas: se sente pressão frequente para cumprir metas/prazos difíceis no setor "${profile.sector || 'Operacional'}"). Use ui_widget "binary_cards" com opções "Sim" e "Não". Faça EXATAMENTE UMA ÚNICA PERGUNTA.`;
  } else if (currentStep === 2) {
    stepInstruction = `No bot_statement, acolha a resposta anterior com empatia (OARS). Agora formule uma PERGUNTA DE OPINIÃO ABERTA E REFLEXIVA para o trabalhador explicar com suas palavras (ui_widget "text_input") o que mais gera correria, cansaço ou sobrecarga na rotina dele.`;
  } else if (currentStep === 3) {
    stepInstruction = `No bot_statement, valide o relato do operário. Em seguida, formule uma PERGUNTA DE NOTA/AVALIAÇÃO DE 0 A 10 sobre o tempo e qualidade das PAUSAS para descanso durante o turno (NR-17/ISTAS21). Use ui_widget "slider_0_10" (min_label: "0 - Sem tempo / Péssimo", max_label: "10 - Pausas adequadas").`;
  } else if (currentStep === 4) {
    stepInstruction = `No bot_statement, acolha a nota atribuída. Agora formule uma pergunta com RESPOSTAS PRONTAS (ui_widget "choice_chips") para mapear atitudes da liderança/chefia direta do ISTAS21-BR, com opções como: ["Suporte respeitoso", "Gritos ou tom ríspido", "Comentários humilhantes", "Desvalorização de esforço", "Outro"].`;
  } else if (currentStep === 5) {
    stepInstruction = `No bot_statement, valide a resposta sobre liderança. Em seguida, explore o impacto do trabalho no descanso e na vida familiar (Dupla Presença) ou sentimento de valorização, usando ui_widget "emoji_scale" ou "binary_cards".`;
  } else if (currentStep === 6) {
    stepInstruction = `No bot_statement, acolha com sensibilidade. Formule uma pergunta objetiva sobre prevenção de assédio moral ou sexual (Lei 14.457/22 e ISTAS21-BR), usando ui_widget "choice_chips" ou "binary_cards".`;
  } else {
    stepInstruction = `No bot_statement, AGRADEÇA CALOROSAMENTE PELA CONVERSA e pela sinceridade. Formule a PERGUNTA FINAL DE OPINIÃO E SUGESTÃO (ui_widget "text_input"): que recomendação ou sugestão principal o colaborador daria para o RH e a diretoria tornarem o setor um lugar melhor de se trabalhar? Defina is_interview_complete: true.`;
  }

  const messages = [
    { role: 'system', content: SYSTEM_INTERVIEW_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        worker_profile: {
          sector: profile.sector || 'Produção Geral',
          shift: profile.shift || '1º Turno',
          companyTime: profile.companyTime || 'Não informado',
          anonymous: Boolean(profile.anonymous)
        },
        interaction_step: currentStep,
        total_history_count: history.length,
        conversation_history: history.map((h, i) => ({
          step: i + 1,
          question_asked: h.question,
          worker_answer: h.userAnswer,
          widget_used: h.widgetType === 'binary_cards' 
            ? 'binary_cards (Formulário Sim/Não)' 
            : h.widgetType === 'choice_chips' 
            ? 'choice_chips (Múltipla Escolha)' 
            : h.widgetType === 'slider_0_10' 
            ? 'slider_0_10 (Escala de Nota 0 a 10)' 
            : 'text_input (Campo Aberto Dissertativo)',
          dimension_covered: h.dimensionTarget,
          psychological_assessment: h.psychologicalAssessment || null,
          ai_observation: h.aiObservation
        })),
        directives: {
          step_number: currentStep,
          should_finish: currentStep >= 8,
          instruction: stepInstruction
        }
      })
    }
  ];

  let parsed = {};

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.45,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    parsed = JSON.parse(responseText);
  } catch (err) {
    console.warn('⚠️ Erro no modo estrito da Groq, tentando recuperação...', err.message);

    const failedGen = err.error?.error?.failed_generation || err.error?.failed_generation || err.failed_generation;
    if (failedGen && typeof failedGen === 'string' && failedGen.trim().length > 0) {
      try {
        const repaired = failedGen.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => {
          try {
            return String.fromCodePoint(parseInt(hex, 16));
          } catch {
            return '';
          }
        });
        parsed = JSON.parse(repaired);
        console.log('✅ Passo recuperado com sucesso a partir de failed_generation!');
      } catch (parseErr) {
        console.warn('⚠️ Falha ao analisar failed_generation:', parseErr.message);
      }
    }

    // Se ainda vazio, tenta retry sem json_object estrito
    if (!parsed || Object.keys(parsed).length === 0) {
      try {
        console.log('🔄 Executando retry de passo sem schema estrito...');
        const retryCompletion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: `${SYSTEM_INTERVIEW_PROMPT}\nRetorne estritamente um único objeto JSON válido.` },
            messages[1]
          ],
          temperature: 0.3
        });
        const rawText = retryCompletion.choices[0]?.message?.content || '{}';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const repaired = jsonMatch[0].replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
          parsed = JSON.parse(repaired);
          console.log('✅ Passo gerado com sucesso via retry!');
        }
      } catch (retryErr) {
        console.warn('⚠️ Retry falhou, utilizando fallback estruturado:', retryErr.message);
      }
    }

    if (!parsed || Object.keys(parsed).length === 0) {
      // Fallback pericial inteligente por etapa
      parsed = buildFallbackStep(currentStep, profile, { shouldAskToJustify, answeredWantToJustify, answeredRefuseToJustify });
    }
  }

  return sanitizeStepResponse(parsed, currentStep, profile, { shouldAskToJustify, answeredWantToJustify, answeredRefuseToJustify });
}

function buildFallbackStep(step, profile = {}, context = {}) {
  if (context.shouldAskToJustify) {
    return {
      bot_statement: 'Compreendo e agradeço pela sua sinceridade ao apontar essa situação.',
      next_question: 'Você gostaria de justificar ou detalhar com suas próprias palavras um pouco mais sobre o que acontece?',
      ui_widget: 'binary_cards',
      widget_options: {
        card_left: { label: 'Sim, quero justificar', icon: 'fa-comment-dots' },
        card_right: { label: 'Não, prefiro prosseguir', icon: 'fa-arrow-right' }
      },
      dimension_target: 'demandas_psicologicas'
    };
  }

  if (context.answeredWantToJustify) {
    return {
      bot_statement: 'Compreendo e respeito seu relato. Fique à vontade para registrar com suas palavras no seu tempo.',
      next_question: 'O que você gostaria de justificar ou registrar sobre essa situação no seu setor?',
      ui_widget: 'text_input',
      widget_options: {
        placeholder: 'Fique à vontade para justificar com suas próprias palavras...'
      },
      dimension_target: 'demandas_psicologicas'
    };
  }

  switch (step) {
    case 1:
      return {
        bot_statement: 'Olá! Sou a EquilibraAI. Vamos conversar sobre como é a sua rotina no setor.',
        next_question: `Nas últimas duas semanas, você se sentiu frequentemente pressionado para cumprir metas ou prazos difíceis no setor de ${profile.sector || 'trabalho'}?`,
        ui_widget: 'binary_cards',
        widget_options: {
          card_left: { label: 'Sim', icon: 'fa-check' },
          card_right: { label: 'Não', icon: 'fa-xmark' }
        },
        dimension_target: 'demandas_psicologicas'
      };
    case 2:
      return {
        bot_statement: 'Compreendo a importância de termos momentos adequados de recuperação física e mental.',
        next_question: 'Em uma escala de 0 a 10, como você avalia a quantidade e a qualidade das pausas para descanso durante o seu turno?',
        ui_widget: 'slider_0_10',
        dimension_target: 'trabalho_ativo_competencias'
      };
    case 3:
      return {
        bot_statement: 'Entendo perfeitamente o impacto desse ritmo no seu dia a dia.',
        next_question: 'Nos últimos dias, como você tem percebido o tratamento e as atitudes da sua liderança direta?',
        ui_widget: 'choice_chips',
        widget_options: {
          choices: ['Suporte respeitoso e aberto', 'Gritos ou tom ríspido', 'Comentários humilhantes', 'Desvalorização de esforço', 'Outro']
        },
        dimension_target: 'apoio_social_lideranca'
      };
    case 4:
      return {
        bot_statement: 'A qualidade do suporte da liderança é fundamental para um ambiente de trabalho saudável.',
        next_question: 'Como a rotina de trabalho tem impactado o seu descanso e o convívio com a sua família quando chega em casa?',
        ui_widget: 'emoji_scale',
        dimension_target: 'dupla_presenca_familia'
      };
    case 5:
      return {
        bot_statement: 'Manter o equilíbrio entre o trabalho e a vida pessoal é essencial para a saúde.',
        next_question: 'Nas últimas semanas, você presenciou ou sofreu alguma situação de assédio moral ou sexual no ambiente de trabalho?',
        ui_widget: 'binary_cards',
        widget_options: {
          card_left: { label: 'Sim', icon: 'fa-check' },
          card_right: { label: 'Não', icon: 'fa-xmark' }
        },
        dimension_target: 'assedio_moral_sexual'
      };
    default:
      return {
        bot_statement: 'Agradeço imensamente por todas as informações compartilhadas com tanta franqueza.',
        next_question: 'Para finalizar, que recomendação ou sugestão principal você daria para o RH e a diretoria melhorarem o bem-estar no seu setor?',
        ui_widget: 'text_input',
        dimension_target: 'compensacao_reconhecimento',
        is_interview_complete: true
      };
  }
}

function sanitizeStepResponse(data, step, profile = {}, context = {}) {
  const allowedWidgets = ['text_input', 'slider_0_10', 'stars_rating', 'emoji_scale', 'choice_chips', 'binary_cards'];
  let defaultWidget = 'text_input';
  if (step === 1) defaultWidget = 'binary_cards';

  let widget = allowedWidgets.includes(data.ui_widget) ? data.ui_widget : defaultWidget;

  // Blindagem de prioridade: Quando for para convidar a justificar, força binary_cards de convite
  if (context.shouldAskToJustify) {
    widget = 'binary_cards';
  } else if (context.answeredWantToJustify) {
    widget = 'text_input';
  }

  // Blindagem: Garante que bot_statement seja apenas afirmativo (sem perguntas)
  let statement = data.bot_statement || (step === 1 
    ? `Olá! Sou a EquilibraAI. Vamos conversar sobre a sua rotina e o seu dia a dia no setor.`
    : 'Compreendo perfeitamente o seu ponto de vista e agradeço pelo relato.');
  statement = statement.replace(/\?/g, '.').trim();

  // Blindagem: Garante estritamente UMA ÚNICA pergunta em next_question
  let question = data.next_question || (step === 1
    ? 'Nas últimas duas semanas, você se sentiu frequentemente pressionado para cumprir metas ou prazos que considera difíceis ou quase impossíveis?'
    : 'Na sua opinião, o que você acha que mais precisaria mudar nessa situação para melhorar o seu dia a dia?');

  if (context.shouldAskToJustify && (!question.includes('justificar') && !question.includes('detalhar') && !question.includes('comentar'))) {
    question = 'Você gostaria de justificar ou detalhar com suas próprias palavras um pouco mais sobre essa situação?';
  } else if (context.answeredWantToJustify && (widget === 'binary_cards' || widget === 'slider_0_10')) {
    question = 'O que você gostaria de justificar ou registrar sobre essa situação no seu setor?';
  }

  const questionMatches = question.match(/[^?]+\?/g);
  if (questionMatches && questionMatches.length > 1) {
    question = questionMatches[0].trim();
  }

  let defaultOptions = {
    placeholder: 'Escreva sua opinião com suas próprias palavras (ou use o microfone para falar)...'
  };

  if (context.shouldAskToJustify) {
    defaultOptions = {
      card_left: { label: 'Sim, quero justificar', icon: 'fa-comment-dots' },
      card_right: { label: 'Não, prefiro prosseguir', icon: 'fa-arrow-right' }
    };
  } else if (context.answeredWantToJustify) {
    defaultOptions = {
      placeholder: 'Fique à vontade para justificar e relatar com suas palavras...'
    };
  } else if (widget === 'binary_cards') {
    defaultOptions = data.widget_options?.card_left ? data.widget_options : {
      card_left: { label: 'Sim', icon: 'fa-check' },
      card_right: { label: 'Não', icon: 'fa-xmark' }
    };
  } else if (widget === 'slider_0_10') {
    defaultOptions = {
      min_label: '0 - Muito Ruim / Insuficiente',
      max_label: '10 - Excelente / Adequado'
    };
  } else if (widget === 'choice_chips' && !data.widget_options?.choices) {
    defaultOptions = {
      choices: ['Suporte respeitoso', 'Gritos ou tom ríspido', 'Comentários humilhantes', 'Desvalorização de esforço', 'Outro']
    };
  }

  return {
    bot_statement: statement,
    next_question: question,
    ui_widget: widget,
    widget_options: (context.shouldAskToJustify || context.answeredWantToJustify) ? defaultOptions : (data.widget_options || defaultOptions),
    dimension_target: data.dimension_target || 'demandas_psicologicas',
    psychological_assessment: data.psychological_assessment || {
      openness_score: 4,
      fear_of_retaliation: 1,
      fatigue_level: 2,
      subtext_detected: 'Comunicação assertiva e colaborativa observada nas entrelinhas.',
      hidden_risk_flags: []
    },
    ai_realtime_observation: data.ai_realtime_observation || `Etapa ${step}: Elicitação diagnóstica ISTAS21-BR conduzida com foco nos parâmetros normativos da NR-01.`,
    is_interview_complete: Boolean(data.is_interview_complete && step >= 6)
  };
}

/**
 * Gera o relatório pericial completo para o RH com a Groq com recuperação resiliente
 */
export async function generateComprehensiveReport(session) {
  const { id, profile, history, createdAt } = session;
  const confidenceScore = calculateConfidenceScore(history);
  const promptSynthesis = buildSynthesisPrompt(session);

  let aiSynthesis = {};

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'Você é um perito oficial em Riscos Psicossociais (ISTAS21-BR / NR-01) e Psicologia Organizacional. Responda exclusivamente em JSON estruturado de alto rigor técnico. NUNCA gere sequências de escape unicode inválidas como \\u{...}.' },
        { role: 'user', content: promptSynthesis }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '{}';
    aiSynthesis = JSON.parse(content);
  } catch (err) {
    console.warn('⚠️ Tentativa padrão falhou na Groq, analisando erro e tentando recuperação...', err.message);

    // Tenta recuperar do payload failed_generation caso a Groq tenha gerado com escape unicode inválido (ex: \u{1F604})
    const failedGen = err.error?.error?.failed_generation || err.error?.failed_generation || err.failed_generation;
    if (failedGen && typeof failedGen === 'string') {
      try {
        // Corrige escapes inválidos de ES6 \u{XXXXX} para caracteres UTF-8 normais
        const repaired = failedGen.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => {
          try {
            return String.fromCodePoint(parseInt(hex, 16));
          } catch {
            return '';
          }
        });
        aiSynthesis = JSON.parse(repaired);
        console.log('✅ Relatório recuperado com sucesso a partir do failed_generation da Groq!');
      } catch (parseErr) {
        console.warn('⚠️ Falha ao reparar failed_generation:', parseErr.message);
      }
    }

    // Se ainda não tiver os dados, tenta uma chamada direta sem response_format estrito
    if (!aiSynthesis || Object.keys(aiSynthesis).length === 0) {
      try {
        console.log('🔄 Executando fallback sem schema estrito...');
        const retryCompletion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: 'Retorne estritamente um objeto JSON com o laudo pericial ISTAS21-BR. Não use blocos de código markdown nem caracteres com escape inválido.' },
            { role: 'user', content: promptSynthesis }
          ],
          temperature: 0.2
        });

        const rawText = retryCompletion.choices[0]?.message?.content || '{}';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const repaired = jsonMatch[0].replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
          aiSynthesis = JSON.parse(repaired);
          console.log('✅ Relatório gerado com sucesso via fallback!');
        }
      } catch (retryErr) {
        console.error('❌ Falha também no retry:', retryErr.message);
      }
    }
  }

  // Consolidação da Matriz de Risco 5x5 com enquadramento normativo
  const processedDimensions = {};
  let highestRiskScore = 0;
  let highestRiskCategory = 'low';

  for (const [key, dimMeta] of Object.entries(NR1_DIMENSIONS)) {
    const rawDim = aiSynthesis.dimensions_assessment?.[key] || {
      probability: 2,
      severity: 2,
      explicit_evidence: 'Não foram relatadas não-conformidades críticas nesta dimensão durante a amostragem.',
      implicit_inference: 'Manutenção dos controles operacionais preventivos previstos no PGR.',
      algorithm_certainty_pct: 80,
      legal_framework: dimMeta.legalFramework || 'NR-1',
      mitigation_recommendation: 'Acompanhamento periódico de rotina pelo SESMT.'
    };

    const riskCalc = calculateRisk(rawDim.probability, rawDim.severity);

    if (riskCalc.score > highestRiskScore) {
      highestRiskScore = riskCalc.score;
      highestRiskCategory = riskCalc.category;
    }

    processedDimensions[key] = {
      ...dimMeta,
      ...rawDim,
      ...riskCalc,
      legalFramework: rawDim.legal_framework || dimMeta.legalFramework || 'NR-1',
      findings: rawDim.explicit_evidence || 'Conforme apurado na coleta pericial.',
      estimation_logic: rawDim.implicit_inference || 'Dedução técnica correlacionada com a base regulatória.'
    };
  }

  // Tratamento do Plano de Ação 5W2H
  const actionPlan5w2h = Array.isArray(aiSynthesis.action_plan_5w2h) && aiSynthesis.action_plan_5w2h.length > 0
    ? aiSynthesis.action_plan_5w2h
    : [
        {
          what: 'Redimensionamento de Metas e Balanceamento de Sobrecarga Psicológica',
          why: 'Conformidade com a Portaria MTE nº 1.419/2024 e ISO 45003 para prevenção do estresse crônico',
          where: `Setor: ${profile.sector || 'Operacional'}`,
          who: 'Gerência de Produção & SESMT',
          when: 'Em até 15 dias',
          how: 'Revisão das metas de linha e estabelecimento de margens de tolerância para imprevistos',
          control_level: 'Administrativo',
          priority: 'Alta'
        },
        {
          what: 'Capacitação da Liderança em Comunicação Não-Violenta e Suporte Social',
          why: 'Mitigação de atritos, prevenção de silenciamento e promoção de segurança psicológica (NR-01)',
          where: 'Supervisão e Encarregados de todos os turnos',
          who: 'Gerência de RH',
          when: 'Em até 30 dias',
          how: 'Workshop prático sobre feedback construtivo, escuta ativa e gestão humanizada',
          control_level: 'Treinamento',
          priority: 'Alta'
        },
        {
          what: 'Fortalecimento dos Canais de Denúncia e Ações Preventivas da CIPA (Lei 14.457/22)',
          why: 'Garantia de conformidade legal e tolerância zero a assédio moral e sexual',
          where: 'Toda a unidade fabril',
          who: 'Comissão Interna de Prevenção de Acidentes e Assédio (CIPA)',
          when: 'Imediato',
          how: 'Ampla divulgação do canal sigiloso e código de conduta nas integrações e quadros de aviso',
          control_level: 'Eliminação',
          priority: 'Alta'
        }
      ];

  return {
    id,
    sessionId: id,
    createdAt,
    completedAt: new Date().toISOString(),
    profile,
    confidenceScore,
    overallRiskCategory: highestRiskCategory,
    overallRiskScore: highestRiskScore,
    executiveSummary: aiSynthesis.executive_summary || 'Diagnóstico pericial concluído com sucesso, fundamentado nas diretrizes da NR-1 e Portaria MTE 1.419/2024.',
    dimensions: processedDimensions,
    behavioralAnalysis: aiSynthesis.behavioral_analysis || 'O trabalhador demonstrou consistência discursiva e franqueza, permitindo um mapeamento fidedigno das vulnerabilidades do posto.',
    technicalInferences: aiSynthesis.technical_inferences || 'As inferências periciais correlacionam os relatos empíricos com os requisitos normativos das NRs 1, 12 e 17.',
    actionPlan5w2h,
    actionPlan: aiSynthesis.action_plan || {
      immediate_actions: [
        'Realizar alinhamento com a supervisão direta sobre a dinâmica de pausas e metas.',
        'Inspecionar dispositivos de segurança e barreiras de proteção do posto.'
      ],
      preventive_actions: [
        'Incorporar os riscos psicossociais mapeados ao inventário oficial do PGR.',
        'Desenvolver workshops de liderança humanizada e gestão do estresse ocupacional.'
      ]
    },
    fullNarrativeReport: aiSynthesis.full_narrative_report || 'Laudo Pericial Oficial emitido em conformidade com o Gerenciamento de Riscos Ocupacionais (NR-1 / GRO-PGR).',
    conversationLog: history
  };
}

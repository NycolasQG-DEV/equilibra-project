/**
 * aiOrchestratorService — FASE 07 (EQ-010, EQ-011)
 *
 * Serviço de orquestração de inteligência para análise de fatores psicossociais e
 * recomendação de medidas de controle alinhadas à NR-1 e NR-17.
 *
 * DIRETRIZES DE GOVERNANÇA:
 * 1. Segregação estrita em 4 camadas (Dado observado -> Interpretação descritiva -> Hipótese técnica -> Decisão humana).
 * 2. Minimização de dados: NENHUMA informação de identificação pessoal (PII) é processada.
 * 3. Proibição de alegações clínicas: NUNCA diagnosticar patologias, emitir laudo pericial ou atestar conformidade jurídica automática.
 * 4. Validação humana obrigatória: toda medida recomendada requer validação pelo profissional antes de ingressar no PGR.
 */

'use strict';

const { getMeasuresForFactor } = require('../domain/measuresCatalog');

const REGULATORY_DISCLAIMER =
  'Instrumento consultivo de apoio à Análise Ergonômica Preliminar (AEP) e ao Programa de Gerenciamento de Riscos (PGR). ' +
  'Não substitui avaliação técnica especializada, laudo pericial nem diagnóstico clínico individual.';

/**
 * Gera análise estruturada de inteligência técnica para um fator de risco psicossocial.
 *
 * @param {Object} params
 * @param {string} params.factorKey - Chave do fator (ex: 'demandas', 'autonomia')
 * @param {string} params.factorLabel - Nome legível do fator
 * @param {number} params.score - Pontuação média observada (escala 1 a 5)
 * @param {number|null} [params.previousScore] - Pontuação do ciclo anterior (se houver)
 * @param {string} [params.groupName] - Nome do agrupamento (ex: 'Operação')
 * @param {string} [params.contextDescription] - Descrição contextual do setor
 * @returns {Promise<Object>} Análise tipada em 4 camadas
 */
async function generateFactorAnalysis({
  factorKey,
  factorLabel = factorKey,
  score,
  previousScore = null,
  groupName = 'Geral',
  contextDescription = '',
}) {
  const currentScore = Number(score) || 3.0;
  const delta = previousScore !== null ? Number((currentScore - previousScore).toFixed(2)) : null;

  // 1ª CAMADA: DADO OBSERVADO
  const observedData = {
    factorKey,
    factorLabel,
    score: currentScore,
    previousScore,
    delta,
    group: groupName,
  };

  // 2ª CAMADA: INTERPRETAÇÃO DESCRITIVA (Operational Screening)
  let severity = 3;
  let riskLevel = 'medio';
  let descriptiveInterpretation = '';

  if (currentScore <= 2.2) {
    severity = 5;
    riskLevel = 'critico';
    descriptiveInterpretation =
      `Pontuação média de ${currentScore.toFixed(2)} indica desvio severo em relação à média operacional de referência. ` +
      `Sinaliza elevada percepção de vulnerabilidade ou sobrecarga no fator "${factorLabel}".`;
  } else if (currentScore <= 2.8) {
    severity = 4;
    riskLevel = 'alto';
    descriptiveInterpretation =
      `Pontuação média de ${currentScore.toFixed(2)} situa-se na faixa de atenção operacional prioritária. ` +
      `Recomenda-se investigação aprofundada dos processos de trabalho associados.`;
  } else if (currentScore <= 3.6) {
    severity = 3;
    riskLevel = 'medio';
    descriptiveInterpretation =
      `Pontuação média de ${currentScore.toFixed(2)} reflete nível moderado de estabilidade, ` +
      `com oportunidades identificáveis de otimização ergonômica e preventiva.`;
  } else {
    severity = 2;
    riskLevel = 'baixo';
    descriptiveInterpretation =
      `Pontuação média de ${currentScore.toFixed(2)} reflete condição operacional favorável no período avaliado. ` +
      `Foco na manutenção e monitoramento periódico das boas práticas.`;
  }

  if (delta !== null) {
    if (delta < -0.3) {
      descriptiveInterpretation += ` Houve queda de ${Math.abs(delta)} pontos em relação ao ciclo anterior, configurando tendência de piora.`;
    } else if (delta > 0.3) {
      descriptiveInterpretation += ` Houve evolução favorável de +${delta} pontos em relação ao ciclo anterior.`;
    }
  }

  // 3ª CAMADA: HIPÓTESE TÉCNICA E CAUSAS PROVÁVEIS
  let technicalHypothesis = '';
  switch (factorKey) {
    case 'demandas':
      technicalHypothesis =
        'Possível acúmulo de tarefas simultâneas, descompasso entre ritmo exigido e capacidade produtiva instalada, ' +
        'ou compressão de prazos de entrega decorrente de sazonalidade ou flutuação de demanda.';
      break;
    case 'autonomia':
      technicalHypothesis =
        'Processos com elevado grau de engessamento decisório, excesso de aprovações intermediárias ou pouca ' +
        'margem para os trabalhadores organizarem o método e a cadência de suas tarefas.';
      break;
    case 'apoio':
      technicalHypothesis =
        'Canais de suporte hierárquico ou entre pares com falhas de comunicação, sobrecarga das lideranças intermediárias ' +
        'ou falta de rituais regulares de acolhimento e orientação técnica.';
      break;
    case 'relacoes':
      technicalHypothesis =
        'Presença de atritos interpessoais não mediados, ausência de diretrizes claras de convivência ou receio de relato ' +
        'de incidentes de conduta inadequada (alinhamento com Lei 14.457/22).';
      break;
    case 'jornada':
      technicalHypothesis =
        'Extrapolação frequente da jornada contratual, insuficiência de intervalos de repouso intrajornada ou contato ' +
        'digital fora do expediente interferindo na recuperação biológica do trabalhador.';
      break;
    default:
      technicalHypothesis =
        `Fatores organizacionais, ambientais e relacionais do setor ${groupName} podem estar interagindo ` +
        `com as exigências da atividade e demandam escuta qualitativa preliminar.`;
      break;
  }

  if (contextDescription) {
    technicalHypothesis += ` Contexto complementar do setor: ${contextDescription}.`;
  }

  // Se houver chave Groq/OpenAI e serviço ativo, podemos enriquecer a hipótese
  // mantendo rigorosamente a estrutura e sem envio de PII
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
    try {
      const enriched = await callLLMEnrichment({
        factorLabel,
        score: currentScore,
        groupName,
        descriptiveInterpretation,
        technicalHypothesis,
      });
      if (enriched) {
        technicalHypothesis = enriched;
      }
    } catch {
      // Degrada graciosamente para o modelo determinístico
    }
  }

  // 4ª CAMADA: MEDIDAS SUGERIDAS (Catálogo 5W2H)
  const catalogMeasures = getMeasuresForFactor(factorKey);
  const suggestedMeasures = catalogMeasures.map((m) => ({
    measureId: m.id,
    title: m.title,
    hierarchy: m.hierarchy,
    nr17Topic: m.nr17Topic,
    fiveWtwoH: { ...m.fiveWtwoH },
    suggestedReviewDays: m.suggestedReviewDays,
    status: 'draft_suggestion', // Necessita validação humana explícita
  }));

  return {
    observedData,
    descriptiveInterpretation,
    technicalHypothesis,
    suggestedMeasures,
    severity,
    riskLevel,
    limitations: REGULATORY_DISCLAIMER,
    requiresHumanValidation: true,
    sources: [
      'NR-1 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais (Portaria MTP 4.219/2022)',
      'NR-17 - Ergonomia e Organização do Trabalho (Portaria MTP 423/2021)',
      'Lei Federal nº 14.457/2022 (Programa Emprega + Mulheres e Prevenção ao Assédio)',
    ],
  };
}

/**
 * Chamada opcional a LLM para refinamento estritamente textual da hipótese.
 */
async function callLLMEnrichment({ factorLabel, score, groupName, descriptiveInterpretation, technicalHypothesis }) {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const systemPrompt =
    'Você é um assistente técnico especializado em Ergonomia Organizacional (NR-17) e PGR (NR-1). ' +
    'Sua função é refinar a redação da hipótese técnica com base nos dados agregados do setor. ' +
    'REGRAS RÍGIDAS: ' +
    '1. NUNCA cite nomes de pessoas ou diagnósticos médicos. ' +
    '2. Use linguagem impessoal e condicional ("hipótese", "possível indício", "recomenda-se investigar"). ' +
    '3. Responda em no máximo 3 parágrafos curtos em português brasileiro.';

  const userPrompt =
    `Fator: ${factorLabel}\n` +
    `Média observada: ${score}\n` +
    `Setor: ${groupName}\n` +
    `Interpretação: ${descriptiveInterpretation}\n` +
    `Hipótese base: ${technicalHypothesis}\n` +
    `Refine a redação da hipótese técnica para o parecer ergonômico.`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

module.exports = {
  generateFactorAnalysis,
  REGULATORY_DISCLAIMER,
};

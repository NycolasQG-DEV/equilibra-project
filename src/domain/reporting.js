// src/domain/reporting.js
// Motor de resultados, relatórios de ciclo e privacidade da plataforma Equilibra.
// Módulo puro (sem chamadas HTTP ou I/O de disco).

const crypto = require('node:crypto');
const { aggregate, summarizeDistribution, compareReports } = require('./analysis');
const { classifyFactor, evaluateTrend, REFERENCE_BANDS_CONFIG } = require('../config/referenceBands');
const { getBand } = require('../services/surveyLifecycle');

const DEFAULT_MIN_RESULTS = 5;

/**
 * Agrupa segmentos por partição para garantir que nenhum bucket tenha n < minResults.
 * Algoritmo determinístico e complementarmente seguro:
 * 1. Calcula n por segmento
 * 2. Ordena por n crescente
 * 3. Mescla o menor com o próximo menor em "Demais áreas (agrupadas)" até que todos tenham n >= minResults
 * 4. Se restar apenas 1 bucket, não há matriz (apenas o total).
 *
 * @param {Array} segments Lista de segmentos da pesquisa [{ id, name, invited }]
 * @param {Array} responses Lista de respostas [{ segmentId, answers }]
 * @param {number} minResults Mínimo de respostas exigidas
 * @param {object} instrument Instrumento da pesquisa
 * @returns {object} { hasMatrix, buckets, merged, notes }
 */
function partitionSegments({ segments = [], responses = [], minResults = DEFAULT_MIN_RESULTS, instrument }) {
  if (!responses.length) {
    return { hasMatrix: false, buckets: [], merged: [], notes: 'Sem respostas registradas para recorte.' };
  }

  // Mapeia respostas por segmentId
  const responsesBySegment = new Map();
  const legacyResponses = [];

  for (const resp of responses) {
    if (resp.segmentId) {
      if (!responsesBySegment.has(resp.segmentId)) {
        responsesBySegment.set(resp.segmentId, []);
      }
      responsesBySegment.get(resp.segmentId).push(resp);
    } else {
      legacyResponses.push(resp);
    }
  }

  // Cria buckets iniciais a partir da lista de segmentos
  let buckets = [];
  const segmentMap = new Map((segments || []).map(s => [s.id, s]));

  for (const seg of segments) {
    const segResponses = responsesBySegment.get(seg.id) || [];
    buckets.push({
      id: seg.id,
      name: seg.name,
      n: segResponses.length,
      invited: seg.invited || 0,
      responses: segResponses,
      isMerged: false,
      originalSegments: [seg.name]
    });
  }

  // Segmentos sem correspondência direta em survey.segments
  for (const [segId, segResponses] of responsesBySegment.entries()) {
    if (!segmentMap.has(segId)) {
      buckets.push({
        id: segId,
        name: `Área (${segId})`,
        n: segResponses.length,
        invited: 0,
        responses: segResponses,
        isMerged: false,
        originalSegments: [`Área (${segId})`]
      });
    }
  }

  // Respostas legadas sem segmentId:
  // Só formam bucket se n >= minResults; caso contrário não formam bucket (ficam só no total)
  if (legacyResponses.length >= minResults) {
    buckets.push({
      id: 'sem_segmento',
      name: 'Sem segmento (ciclo anterior ao recorte por grupo)',
      n: legacyResponses.length,
      invited: 0,
      responses: legacyResponses,
      isMerged: false,
      originalSegments: ['Sem segmento']
    });
  }

  // Filtra buckets vazios (n === 0) para o agrupamento estatístico
  buckets = buckets.filter(b => b.n > 0);

  if (buckets.length <= 1) {
    return {
      hasMatrix: false,
      buckets: [],
      merged: [],
      notes: buckets.length === 1
        ? 'Apenas um segmento ativo com respostas foi identificado; o resultado é exibido exclusivamente no total coletivo.'
        : 'Nenhum segmento com respostas suficientes para composição de matriz.'
    };
  }

  const mergedHistory = [];

  // Loop de partição: enquanto existir algum bucket com n < minResults
  while (buckets.some(b => b.n < minResults)) {
    if (buckets.length <= 1) break;

    // Ordena por n crescente, desempate por nome alfabético
    buckets.sort((a, b) => a.n - b.n || a.name.localeCompare(b.name));

    // Pega o menor e o segundo menor
    const smallest = buckets.shift();
    const secondSmallest = buckets.shift();

    const mergedName = 'Demais áreas (agrupadas)';
    const combinedOriginal = [...smallest.originalSegments, ...secondSmallest.originalSegments];
    const combinedResponses = [...smallest.responses, ...secondSmallest.responses];
    const combinedInvited = smallest.invited + secondSmallest.invited;

    mergedHistory.push({
      from: [smallest.name, secondSmallest.name],
      into: mergedName,
      n: combinedResponses.length
    });

    const newBucket = {
      id: 'merged_demais_areas',
      name: mergedName,
      n: combinedResponses.length,
      invited: combinedInvited,
      responses: combinedResponses,
      isMerged: true,
      originalSegments: combinedOriginal
    };

    buckets.push(newBucket);
  }

  // Se restou apenas um único bucket após as mesclagens
  if (buckets.length <= 1) {
    return {
      hasMatrix: false,
      buckets: [],
      merged: mergedHistory,
      notes: 'Todas as áreas foram agrupadas por proteção de privacidade (tamanhos de amostra inferiores ao limite seguro de 5 respostas). Os resultados são exibidos exclusivamente no total coletivo.'
    };
  }

  // Se todos os buckets finais têm n >= minResults, calcula os fatores de cada bucket
  const finalBuckets = buckets.map(bucket => {
    const bucketAggregate = aggregate(bucket.responses, instrument) || [];
    const factors = bucketAggregate.map(item => {
      const classification = classifyFactor(item.average);
      return {
        key: item.key,
        label: item.label,
        average: item.average,
        n: bucket.n,
        level: classification?.level || 'unclassified',
        levelLabel: classification?.label || 'Sem faixa',
        levelIcon: classification?.icon || '—'
      };
    });

    const rate = bucket.invited > 0 ? Math.round((bucket.n / bucket.invited) * 100) / 100 : null;

    return {
      id: bucket.id,
      name: bucket.name,
      n: bucket.n,
      invited: bucket.invited,
      rate,
      band: getBand(rate ?? 0),
      isMerged: bucket.isMerged,
      originalSegments: bucket.originalSegments,
      factors
    };
  });

  return {
    hasMatrix: true,
    buckets: finalBuckets,
    merged: mergedHistory,
    notes: mergedHistory.length
      ? `Para garantir a confidencialidade e impedir inferência individual, áreas com menos de ${minResults} respostas foram consolidadas em "Demais áreas (agrupadas)".`
      : null
  };
}

/**
 * Calcula a tabela de participação particionada.
 */
function buildParticipationSummary({ segments = [], responses = [], totalInvited = 0, minResults = DEFAULT_MIN_RESULTS, partition }) {
  const totalResponded = responses.length;
  const totalRate = totalInvited > 0 ? Math.round((totalResponded / totalInvited) * 100) / 100 : 0;

  // Se temos uma partição com buckets válidos, usamos os buckets
  let segmentRows = [];
  if (partition?.hasMatrix && partition.buckets.length > 0) {
    segmentRows = partition.buckets.map(b => ({
      name: b.name,
      invited: b.invited,
      responded: b.n,
      rate: b.rate,
      band: b.band,
      isMerged: b.isMerged
    }));
  } else if (segments && segments.length > 0) {
    // Se não há matriz, ainda podemos reportar segmentos desde que individualmente >= minResults,
    // caso contrário não expor segmentos pequenos
    const safeSegments = [];
    let smallInvited = 0;
    let smallResponded = 0;
    const smallNames = [];

    for (const seg of segments) {
      const segResp = responses.filter(r => r.segmentId === seg.id).length;
      if (segResp >= minResults) {
        const rate = seg.invited > 0 ? Math.round((segResp / seg.invited) * 100) / 100 : 0;
        safeSegments.push({
          name: seg.name,
          invited: seg.invited,
          responded: segResp,
          rate,
          band: getBand(rate),
          isMerged: false
        });
      } else if (segResp > 0) {
        smallInvited += seg.invited;
        smallResponded += segResp;
        smallNames.push(seg.name);
      }
    }

    if (smallResponded >= minResults) {
      const rate = smallInvited > 0 ? Math.round((smallResponded / smallInvited) * 100) / 100 : 0;
      safeSegments.push({
        name: 'Demais áreas (agrupadas)',
        invited: smallInvited,
        responded: smallResponded,
        rate,
        band: getBand(rate),
        isMerged: true
      });
    }

    segmentRows = safeSegments;
  }

  return {
    total: {
      invited: totalInvited,
      responded: totalResponded,
      rate: totalRate,
      band: getBand(totalRate)
    },
    segments: segmentRows,
    disclaimer: 'Cinco respostas protegem a divulgação; não demonstram representatividade estatística.'
  };
}

/**
 * Gera um resumo textual determinístico a partir dos dados do ciclo (sem IA).
 */
function generateRuleBasedSummary({ factors = [], comparison, segmentation, participation }) {
  if (!factors || !factors.length) return null;

  const highlights = [];

  const attentionFactors = factors.filter(f => f.level === 'atencao');
  const careFactors = factors.filter(f => f.level === 'cuidado');
  const adequateFactors = factors.filter(f => f.level === 'adequado');

  // Destaque de atenção
  if (attentionFactors.length > 0) {
    highlights.push({
      type: 'warning',
      text: `${attentionFactors.length} fator(es) em faixa de atenção (média < 2,80): ${attentionFactors.map(f => `"${f.label}" (${f.average.toFixed(2)})`).join(', ')}.`,
      factorKey: attentionFactors[0].key
    });
  } else {
    highlights.push({
      type: 'positive',
      text: 'Nenhum fator classificado na faixa de atenção prioritária neste ciclo.'
    });
  }

  // Fatores extremos
  const sortedByAvg = [...factors].sort((a, b) => a.average - b.average);
  const worstFactor = sortedByAvg[0];
  const bestFactor = sortedByAvg[sortedByAvg.length - 1];

  // Comparação com ciclo anterior
  let greatestImprovement = null;
  let greatestDecline = null;

  if (comparison?.comparable && Array.isArray(comparison.factors)) {
    const withDeltas = comparison.factors.filter(f => typeof f.delta === 'number' && !Number.isNaN(f.delta));
    if (withDeltas.length) {
      const sortedByDelta = [...withDeltas].sort((a, b) => b.delta - a.delta);
      const topGain = sortedByDelta[0];
      const topLoss = sortedByDelta[sortedByDelta.length - 1];

      if (topGain.delta > REFERENCE_BANDS_CONFIG.toleranceDelta) {
        greatestImprovement = topGain;
        highlights.push({
          type: 'positive',
          text: `Maior evolução positiva: "${topGain.label}" (+${topGain.delta.toFixed(2)} vs. ciclo anterior).`,
          factorKey: topGain.key
        });
      }
      if (topLoss.delta < -REFERENCE_BANDS_CONFIG.toleranceDelta) {
        greatestDecline = topLoss;
        highlights.push({
          type: 'warning',
          text: `Maior declínio registrado: "${topLoss.label}" (${topLoss.delta.toFixed(2)} vs. ciclo anterior).`,
          factorKey: topLoss.key
        });
      }
    }
  }

  // Menor média por segmento se matriz publicada
  if (segmentation?.hasMatrix && segmentation.buckets.length > 1) {
    let lowestBucket = null;
    let lowestScore = Infinity;

    for (const b of segmentation.buckets) {
      if (b.factors && b.factors.length) {
        const avg = b.factors.reduce((sum, f) => sum + f.average, 0) / b.factors.length;
        if (avg < lowestScore) {
          lowestScore = avg;
          lowestBucket = b;
        }
      }
    }

    if (lowestBucket) {
      highlights.push({
        type: 'neutral',
        text: `Segmento com menor média global: "${lowestBucket.name}" (média ${lowestScore.toFixed(2)}).`
      });
    }
  }

  // Participação
  if (participation?.total) {
    highlights.push({
      type: 'neutral',
      text: `Adesão global de ${Math.round(participation.total.rate * 100)}% (${participation.total.responded} respostas de ${participation.total.invited} pessoas convidadas).`
    });
  }

  // Montagem do parágrafo de texto
  const sentences = highlights.map(h => h.text);
  const text = sentences.join(' ');

  return {
    highlights,
    text,
    factorsInAttentionCount: attentionFactors.length,
    factorsInCareCount: careFactors.length,
    factorsInAdequateCount: adequateFactors.length,
    bestFactor: bestFactor ? { key: bestFactor.key, label: bestFactor.label, average: bestFactor.average } : null,
    worstFactor: worstFactor ? { key: worstFactor.key, label: worstFactor.label, average: worstFactor.average } : null,
    greatestImprovement: greatestImprovement ? { key: greatestImprovement.key, label: greatestImprovement.label, delta: greatestImprovement.delta } : null,
    greatestDecline: greatestDecline ? { key: greatestDecline.key, label: greatestDecline.label, delta: greatestDecline.delta } : null,
    disclaimer: 'Resumo descritivo gerado por regra matemática com base nas médias registradas. Não constitui inferência clínica, laudo técnico ou diagnóstico individual.'
  };
}

/**
 * Constrói o relatório completo do ciclo com regras de privacidade centrais e snapshot versionado.
 *
 * @param {object} params
 * @param {object} params.survey Objeto da pesquisa
 * @param {object} params.instrument Objeto do instrumento/modelo
 * @param {Array} params.responses Respostas da pesquisa
 * @param {Array} [params.previousReports=[]] Relatórios anteriores da conta
 * @param {Array} [params.previousSurveys=[]] Pesquisas anteriores da conta (para validação de sobreposição)
 * @param {number} [params.minResults=5]
 * @returns {object} Relatório estruturado (schemaVersion: 2)
 */
function buildCycleReport({
  survey,
  instrument,
  responses = [],
  previousReports = [],
  previousSurveys = [],
  minResults = DEFAULT_MIN_RESULTS
}) {
  if (!survey) throw new Error('buildCycleReport requer o objeto da pesquisa.');
  if (!instrument) throw new Error('buildCycleReport requer o objeto do instrumento.');

  const totalInvited = survey.memberIds?.length ||
    (survey.segments || []).reduce((sum, s) => sum + (s.invited || 0), 0) ||
    0;

  const publicationReasons = [];

  // 1. Verificação: respostas mínimas
  if (responses.length < minResults) {
    publicationReasons.push({
      code: 'below_min_responses',
      message: `Menos de ${minResults} respostas recebidas (${responses.length} registradas). Para proteger a confidencialidade individual dos participantes, o resultado estatístico não é divulgado.`,
      action: `Convide ao menos ${minResults} pessoas e incentive a adesão na próxima coleta.`
    });
  }

  // 2. Verificação: respostas excedem convidados
  if (totalInvited > 0 && responses.length > totalInvited) {
    publicationReasons.push({
      code: 'responses_exceed_invited',
      message: `O número de respostas (${responses.length}) excede o total de convidados da pesquisa (${totalInvited}).`,
      action: 'Verifique a integridade da lista de convidados e certifique-se de que cada participante utilizou seu link individual.'
    });
  }

  // 3. Verificação: respostas válidas e completas
  const factorKeys = (instrument.factors || []).map(([k]) => k);
  const hasInvalidAnswers = responses.some(row =>
    factorKeys.some(key =>
      !Number.isInteger(row.answers?.[key]) ||
      row.answers[key] < 1 ||
      row.answers[key] > 5
    )
  );

  if (hasInvalidAnswers) {
    publicationReasons.push({
      code: 'invalid_answers',
      message: 'Foram detectadas respostas incompletas ou com formato corrompido que inviabilizam o cálculo das médias.',
      action: 'Revise os registros da coleta e descarte respostas com campos faltantes.'
    });
  }

  // 4. Verificação conservadora de sobreposição de públicos com outros ciclos fechados
  const audience = new Set(survey.memberIds || []);
  if (audience.size > 0 && Array.isArray(previousSurveys)) {
    for (const other of previousSurveys) {
      if (other.id === survey.id || other.status !== 'closed' || !other.result) continue;
      const otherAudience = new Set(other.memberIds || []);
      if (!otherAudience.size) continue;

      const common = [...audience].filter(id => otherAudience.has(id)).length;
      const left = audience.size - common;
      const right = otherAudience.size - common;

      if (common > 0 && ((left > 0 && left < minResults) || (right > 0 && right < minResults))) {
        const diff = Math.min(left > 0 ? left : Infinity, right > 0 ? right : Infinity);
        publicationReasons.push({
          code: 'overlap_with_cycle',
          conflictingCycleId: other.id,
          conflictingCycleTitle: other.title || other.cycle || other.id,
          message: `Resultado protegido por sobreposição de públicos sobrepostos com o ciclo "${other.title || other.cycle}": a diferença entre os grupos (${diff} pessoa(s)) é inferior a ${minResults}. A publicação permitiria inferir respostas individuais por subtração residual.`,
          action: `Evite repetir este público em ciclos seguidos sem pelo menos ${minResults} pessoas diferentes, ou una os grupos antes da abertura.`
        });
        break;
      }
    }
  }

  const isPublished = publicationReasons.length === 0;

  // Cálculo das agregações principais (se publicado)
  let rawAggregate = null;
  let distribution = null;
  let partition = null;

  if (isPublished) {
    rawAggregate = aggregate(responses, instrument);
    distribution = summarizeDistribution(responses, instrument);
    partition = partitionSegments({
      segments: survey.segments || [],
      responses,
      minResults,
      instrument
    });
  }

  // 2.2 Formatação dos fatores com classificação de semáforo
  let factors = null;
  let result = null;
  let generalAverage = null;

  if (isPublished && Array.isArray(rawAggregate)) {
    result = rawAggregate;
    if (rawAggregate.length > 0) {
      const sum = rawAggregate.reduce((acc, f) => acc + (f.average || 0), 0);
      generalAverage = Math.round((sum / rawAggregate.length) * 100) / 100;
    }
    factors = rawAggregate.map(row => {
      const classification = classifyFactor(row.average);
      return {
        key: row.key,
        label: row.label,
        average: row.average,
        n: responses.length,
        level: classification?.level || 'unclassified',
        levelLabel: classification?.label || 'Sem faixa',
        levelIcon: classification?.icon || '—',
        disclaimer: classification?.disclaimer || REFERENCE_BANDS_CONFIG.disclaimer,
        delta: null,
        trend: null,
        previousAverage: null
      };
    });
  }

  // 2.5 Participação
  const participation = buildParticipationSummary({
    segments: survey.segments || [],
    responses,
    totalInvited,
    minResults,
    partition
  });

  // 2.6 Comparação com ciclo anterior compatível
  let comparison = {
    comparable: false,
    previousId: null,
    previousCycle: null,
    reason: 'Nenhum ciclo anterior compatível selecionado.',
    factors: null
  };

  const currentComparableObj = {
    id: survey.id,
    surveyId: survey.id,
    published: isPublished,
    instrument: { id: instrument.id, version: instrument.version },
    audienceFingerprint: survey.audienceFingerprint || null,
    closedAt: survey.closedAt || survey.endsAt || new Date().toISOString(),
    result: rawAggregate
  };

  // Encontra o relatório anterior compatível mais recente
  if (isPublished && Array.isArray(previousReports)) {
    const candidates = previousReports
      .filter(r =>
        r.published &&
        r.surveyId !== survey.id &&
        r.instrument?.id === instrument.id &&
        r.instrument?.version === instrument.version &&
        r.result &&
        new Date(r.closedAt) < new Date(currentComparableObj.closedAt)
      )
      .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));

    if (candidates.length > 0) {
      const prevReport = candidates[0];
      const compResult = compareReports(currentComparableObj, prevReport);
      if (compResult.comparable) {
        comparison = {
          comparable: true,
          previousId: prevReport.id,
          previousCycle: prevReport.cycle,
          reason: null,
          factors: compResult.factors.map(f => {
            const trend = evaluateTrend(f.delta);
            return {
              key: f.key,
              label: f.label,
              average: f.average,
              previous: f.previous,
              delta: f.delta,
              trend
            };
          })
        };

        // Atualiza deltas nos fatores principais
        if (factors) {
          for (const f of factors) {
            const match = comparison.factors.find(cf => cf.key === f.key);
            if (match) {
              f.delta = match.delta;
              f.trend = match.trend;
              f.previousAverage = match.previous;
            }
          }
        }
      } else {
        comparison = {
          comparable: false,
          previousId: prevReport.id,
          previousCycle: prevReport.cycle,
          reason: compResult.reason,
          factors: null
        };
      }
    } else {
      comparison = {
        comparable: false,
        previousId: null,
        previousCycle: null,
        reason: 'Ciclo inaugural ou sem ciclos anteriores compatíveis com o mesmo instrumento.',
        factors: null
      };
    }
  }

  // Séries históricas por fator para gráficos
  const historicalSeries = {};
  if (isPublished && Array.isArray(previousReports)) {
    const compatibleHistory = previousReports
      .filter(r =>
        r.published &&
        r.instrument?.id === instrument.id &&
        r.instrument?.version === instrument.version &&
        Array.isArray(r.result)
      )
      .sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));

    // Inclui os ciclos passados mais o ciclo atual
    const fullTimeline = [
      ...compatibleHistory,
      {
        cycle: survey.cycle,
        closedAt: currentComparableObj.closedAt,
        result: rawAggregate,
        responseCount: responses.length
      }
    ];

    if (factors) {
      for (const f of factors) {
        historicalSeries[f.key] = fullTimeline.map(item => {
          const factorData = item.result.find(r => r.key === f.key);
          return {
            cycle: item.cycle,
            closedAt: item.closedAt,
            average: factorData?.average ?? null,
            n: item.responseCount ?? null
          };
        }).filter(pt => pt.average !== null);
      }
    }
  }

  // 2.7 Resumo determinístico por regra
  const summary = isPublished
    ? generateRuleBasedSummary({ factors, comparison, segmentation: partition, participation, instrument })
    : null;

  const methodologyText = `${instrument.name}, versão ${instrument.version}; ${instrument.factors?.length || 0} afirmações; ${instrument.limitation}`;

  return {
    schemaVersion: 2,
    id: survey.reportId || (survey.reportIdPrefix ? `${survey.reportIdPrefix}-${crypto.randomUUID()}` : crypto.randomUUID()),
    accountId: survey.accountId,
    surveyId: survey.id,
    title: survey.title,
    cycle: survey.cycle,
    model: survey.model,
    groupName: survey.groupNamesSnapshot?.join(', ') || 'Geral',
    groupNames: survey.groupNamesSnapshot || ['Geral'],
    closedAt: survey.closedAt || survey.endsAt || new Date().toISOString(),
    published: isPublished,
    publication: {
      status: isPublished ? 'published' : 'suppressed',
      reasons: publicationReasons
    },
    suppressionReason: publicationReasons.length > 0 ? publicationReasons[0].message : null,
    generalAverage,
    overallAverage: generalAverage,
    responseCount: isPublished ? responses.length : null,
    responsesCount: isPublished ? responses.length : null,
    invitedCount: totalInvited,
    participationRate: participation.total.rate,
    factors,
    result,
    distribution,
    segmentation: partition,
    participation,
    comparison,
    historicalSeries,
    summary,
    recommendations: [], // Campo reservado para catálogo futuro
    instrument: {
      id: instrument.id,
      name: instrument.name,
      version: instrument.version,
      validated: Boolean(instrument.validated)
    },
    audienceFingerprint: survey.audienceFingerprint || null,
    methodology: methodologyText,
    methodologyDetails: {
      text: methodologyText,
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      version: instrument.version,
      factorsCount: instrument.factors?.length || 0,
      limitation: instrument.limitation,
      attribution: instrument.attribution || null,
      sources: instrument.sources || [],
      disclaimer: 'Este relatório tem finalidade descritiva e preventiva no âmbito das ações de SST da organização. Não constitui laudo técnico, diagnóstico clínico ou comprovação isolada de conformidade com a NR-1.',
      referenceBandsDisclaimer: REFERENCE_BANDS_CONFIG.disclaimer
    },
    acceptance: survey.acceptance || null,
    collectionChannel: 'web'
  };
}

/**
 * Pré-visualização de impacto antes de iniciar a pesquisa.
 * Avalia riscos de sobreposição e alerta sobre grupos que serão agrupados.
 */
function preflightSurveyAudience({
  groupIds = [],
  accountGroups = [],
  closedSurveys = [],
  minResults = DEFAULT_MIN_RESULTS
}) {
  const selectedGroups = accountGroups.filter(g => groupIds.includes(g.id));
  const memberSet = new Set();
  const segments = [];

  for (const g of selectedGroups) {
    const memberCount = g.memberIds?.length || 0;
    for (const mId of g.memberIds || []) memberSet.add(mId);
    segments.push({
      id: g.id,
      name: g.name,
      memberCount,
      willBeGroupedIfSmall: memberCount < minResults
    });
  }

  const audienceSize = memberSet.size;
  const smallSegments = segments.filter(s => s.willBeGroupedIfSmall);

  // Verificação de sobreposição com pesquisas fechadas recentes
  const overlapConflicts = [];
  for (const other of closedSurveys) {
    if (other.status !== 'closed' || !other.memberIds) continue;
    const previous = new Set(other.memberIds || []);
    if (!previous.size) continue;

    const common = [...memberSet].filter(id => previous.has(id)).length;
    const left = memberSet.size - common;
    const right = previous.size - common;

    if (common > 0 && ((left > 0 && left < minResults) || (right > 0 && right < minResults))) {
      const diff = Math.min(left > 0 ? left : Infinity, right > 0 ? right : Infinity);
      overlapConflicts.push({
        cycleId: other.id,
        cycleTitle: other.title || other.cycle || other.id,
        diff,
        warning: `Diferença residual de ${diff} pessoa(s) em relação ao ciclo "${other.title || other.cycle}". O resultado desse ciclo ficará protegido por sigilo se ambos forem mantidos.`
      });
    }
  }

  let publishable = true;
  let reason = 'Público suficiente para publicação dos resultados gerais.';

  if (audienceSize < minResults) {
    publishable = false;
    reason = `O público total convidado (${audienceSize}) é inferior ao mínimo necessário (${minResults}). Os resultados ficarão protegidos.`;
  } else if (overlapConflicts.length > 0) {
    publishable = false;
    reason = `Detectado risco de sobreposição de públicos com ${overlapConflicts.length} ciclo(s) anterior(es). O resultado poderá ser protegido.`;
  }

  return {
    audienceSize,
    segmentsCount: segments.length,
    segments,
    smallSegmentsCount: smallSegments.length,
    overlapConflicts,
    prediction: {
      publishable,
      reason
    }
  };
}

module.exports = {
  buildCycleReport,
  partitionSegments,
  buildParticipationSummary,
  generateRuleBasedSummary,
  preflightSurveyAudience,
  DEFAULT_MIN_RESULTS
};

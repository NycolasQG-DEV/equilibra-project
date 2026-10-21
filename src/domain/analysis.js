const { FACTORS, INSTRUMENT } = require("./instruments");

function aggregate(responses, instrument = { ...INSTRUMENT, factors: FACTORS }) {
  const factors = instrument.factors || FACTORS;
  if (
    responses.length < (instrument.minimumResponses || 5) ||
    responses.some((row) =>
      factors.some(
        ([key]) =>
          !Number.isInteger(row.answers?.[key]) ||
          row.answers[key] < 1 ||
          row.answers[key] > 5,
      ),
    )
  )
    return null;
  if (instrument.scoring?.type === 'hse-subscales-v1') {
    const { dimensions, reverseItems } = instrument.scoring;
    return dimensions.map(([key, label, items]) => ({
      key, label,
      average: Math.round(100 * responses.reduce((total, row) => total + items.reduce((sum, item) => sum + (reverseItems.includes(item) ? 6 - row.answers[`hse_${item}`] : row.answers[`hse_${item}`]), 0) / items.length, 0) / responses.length) / 100,
    }));
  }
  return factors.map(([key, label]) => ({
    key,
    label,
    average:
      Math.round(
        (100 * responses.reduce((sum, row) => sum + row.answers[key], 0)) /
          responses.length,
      ) / 100,
  }));
}

function summarizeDistribution(responses, instrument = { ...INSTRUMENT, factors: FACTORS }) {
  const factors = instrument.factors || FACTORS;
  if (responses.length < (instrument.minimumResponses || 5)) return null;
  // Subscale averages are not individual ordinal answers. Do not display an
  // invented five-bin distribution for the HSE subscales.
  if (instrument.scoring) return null;
  return factors.map(([key, label]) => {
    const counts = [1, 2, 3, 4, 5].map(
      (value) => responses.filter((row) => row.answers[key] === value).length,
    );
    // Suppress sparse cells; publishing their complements can reveal small groups.
    const safe = counts.every(
      (count) => count === 0 || count >= (instrument.minimumResponses || 5),
    );
    return { key, label, counts: safe ? counts : null, suppressed: !safe };
  });
}

function compareReports(current, previous) {
  if (!current?.published || !previous?.published)
    return {
      comparable: false,
      reason: "Selecione dois ciclos com resultados publicados.",
    };
  if (current.surveyId === previous.surveyId)
    return { comparable: false, reason: "Selecione ciclos diferentes." };
  if (
    !current.instrument ||
    !previous.instrument ||
    !current.audienceFingerprint ||
    !previous.audienceFingerprint
  )
    return {
      comparable: false,
      reason:
        "Ciclo histórico sem versão ou composição de público verificável.",
    };
  if (
    current.instrument.id !== previous.instrument.id ||
    current.instrument.version !== previous.instrument.version ||
    current.audienceFingerprint !== previous.audienceFingerprint ||
    current.result.length !== previous.result.length ||
    current.result.some(row => !previous.result.some(other => other.key === row.key))
  )
    return {
      comparable: false,
      reason:
        "Instrumentos ou públicos diferentes. Comparação automática indisponível.",
    };
  if (new Date(current.closedAt) <= new Date(previous.closedAt))
    return {
      comparable: false,
      reason: "O ciclo de referência deve ser anterior ao ciclo atual.",
    };
  return {
    comparable: true,
    currentId: current.id,
    previousId: previous.id,
    factors: current.result.map((row) => ({
      ...row,
      previous: previous.result.find((item) => item.key === row.key)?.average,
      delta:
        Math.round(
          100 *
            (row.average -
              previous.result.find((item) => item.key === row.key).average),
        ) / 100,
    })),
  };
}

module.exports = { aggregate, summarizeDistribution, compareReports };

// Existing questionnaires are exploratory. A different label does not create a new instrument.
const FACTORS = [
  ["demandas", "Demandas", "Consigo lidar com o volume de trabalho."],
  ["autonomia", "Autonomia", "Tenho autonomia para organizar meu trabalho."],
  ["apoio", "Apoio", "Recebo apoio quando preciso."],
  ["relacoes", "Relações", "As relações de trabalho são respeitosas."],
  ["reconhecimento", "Reconhecimento", "Meu trabalho é reconhecido."],
  ["jornada", "Jornada", "Minha jornada permite descanso suficiente."],
  [
    "mudancas",
    "Mudanças",
    "As mudanças no trabalho são comunicadas com clareza.",
  ],
  [
    "seguranca",
    "Segurança",
    "Sinto segurança para falar sobre dificuldades no trabalho.",
  ],
];
const MODELS = [
  "Diagnóstico inicial",
  "Pulso mensal",
  "Escuta focada",
  "Remedição de ação",
  "Evento: mudança",
  "Evento: pico ou pressão",
];
const INSTRUMENT = Object.freeze({
  id: "percepcao-exploratoria",
  version: 1,
  name: "Percepção do trabalho",
  validated: false,
  minimumResponses: 5,
});
const { TEMPLATES: exploratoryTemplates, REFERENCES: allReferences } = require('./surveyCatalog');
const TEMPLATES = [...exploratoryTemplates, require('./hseInstrument')];
const REFERENCES = allReferences.filter(row => row.id !== 'hse');
const legacy = { ...INSTRUMENT, factors: FACTORS, instructions: 'Como você percebe o trabalho neste momento? Responda de 1 (Discordo totalmente) a 5 (Concordo totalmente).', limitation: 'Questionário exploratório legado de oito afirmações. Não é diagnóstico ou instrumento validado.', channel: 'web' };
function instrumentForModel(model) {
  return TEMPLATES.find(row => row.name === model) || (MODELS.includes(model) ? legacy : null);
}
function surveyInstrument(survey) {
  // Never reinterpret historical responses using a newly selected template.
  if (survey.instrument) return survey.instrument.factors ? survey.instrument : legacy;
  return instrumentForModel(survey.model) || legacy;
}
function snapshotInstrument(model) {
  const definition = instrumentForModel(model);
  return definition ? JSON.parse(JSON.stringify(definition)) : null;
}
module.exports = { FACTORS, MODELS, INSTRUMENT, TEMPLATES, REFERENCES, instrumentForModel, surveyInstrument, snapshotInstrument };

/**
 * Rotas de Coleta de Evidências — FASE 05 (EQ-008)
 *
 * Registra evidências complementares às pesquisas de clima:
 * questionário | observação | grupo focal | entrevista | documento | indicador
 *
 * Proteção de quórum: dados individualizados só são exibidos em agrupamentos ≥ 5 participantes.
 * Nunca expõe identidade do respondente.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const storage = require('../config/equilibraStorage');

const EVIDENCE_TYPES = [
  'questionario',
  'observacao',
  'grupo_focal',
  'entrevista',
  'documento',
  'indicador_agregado',
];

const QUORUM_MIN = 5; // limiar mínimo para supressão de identidade

function createRouter(protectedRoute) {
  const router = express.Router();
  router.use(protectedRoute);

  // ── GET /evidence — listar evidências do tenant ──────────────────────────
  router.get('/', (req, res) => {
    const all = storage.read('evidences');
    const mine = all.filter((e) => e.accountId === req.account.id);
    res.json(mine);
  });

  // ── POST /evidence — registrar nova evidência ────────────────────────────
  router.post('/', (req, res) => {
    const {
      type,
      title,
      collectionDate,
      responsibleName,
      location,
      activityDescription,
      participantCount,
      groupId,
      surveyId,
      establishmentRef,
      workPeriod,
      sourceDocument,
      observationNotes,
      suppressionApplied,
    } = req.body;

    if (!EVIDENCE_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Tipo inválido. Use um dos seguintes: ${EVIDENCE_TYPES.join(', ')}.`,
      });
    }
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: 'Informe um título descritivo (mínimo 3 caracteres).' });
    }
    if (!collectionDate || !/^\d{4}-\d{2}-\d{2}$/.test(collectionDate)) {
      return res.status(400).json({ error: 'Informe a data de coleta no formato YYYY-MM-DD.' });
    }

    const count = Number(participantCount) || 0;
    // Supressão: se tipo envolve participantes, exige quórum mínimo para registrar contagem real
    const suppressed =
      ['grupo_focal', 'entrevista', 'questionario'].includes(type) && count > 0 && count < QUORUM_MIN;

    const record = {
      id: uuidv4(),
      accountId: req.account.id,
      type,
      title: title.trim(),
      collectionDate,
      responsibleName: responsibleName || null,
      location: location || null,
      activityDescription: activityDescription || null,
      participantCount: suppressed ? null : count || null,
      quorumSuppressed: suppressed || false,
      groupId: groupId || null,
      surveyId: surveyId || null,
      establishmentRef: establishmentRef || null,
      workPeriod: workPeriod || null,
      sourceDocument: sourceDocument || null,
      observationNotes: observationNotes || null,
      createdAt: new Date().toISOString(),
      createdBy: req.account.userId,
    };

    const all = storage.read('evidences');
    all.push(record);
    storage.write('evidences', all);

    res.status(201).json(record);
  });

  // ── GET /evidence/:id — detalhar evidência ───────────────────────────────
  router.get('/:id', (req, res) => {
    const all = storage.read('evidences');
    const record = all.find((e) => e.id === req.params.id && e.accountId === req.account.id);
    if (!record) return res.status(404).json({ error: 'Evidência não encontrada.' });
    res.json(record);
  });

  // ── PUT /evidence/:id — atualizar evidência ──────────────────────────────
  router.put('/:id', (req, res) => {
    const all = storage.read('evidences');
    const idx = all.findIndex((e) => e.id === req.params.id && e.accountId === req.account.id);
    if (idx === -1) return res.status(404).json({ error: 'Evidência não encontrada.' });

    const existing = all[idx];
    const updated = {
      ...existing,
      title: req.body.title ? req.body.title.trim() : existing.title,
      collectionDate: req.body.collectionDate || existing.collectionDate,
      responsibleName: req.body.responsibleName ?? existing.responsibleName,
      location: req.body.location ?? existing.location,
      activityDescription: req.body.activityDescription ?? existing.activityDescription,
      observationNotes: req.body.observationNotes ?? existing.observationNotes,
      sourceDocument: req.body.sourceDocument ?? existing.sourceDocument,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    storage.write('evidences', all);
    res.json(updated);
  });

  // ── DELETE /evidence/:id — remover evidência ─────────────────────────────
  router.delete('/:id', (req, res) => {
    const all = storage.read('evidences');
    const idx = all.findIndex((e) => e.id === req.params.id && e.accountId === req.account.id);
    if (idx === -1) return res.status(404).json({ error: 'Evidência não encontrada.' });
    all.splice(idx, 1);
    storage.write('evidences', all);
    res.status(204).end();
  });

  // ── GET /evidence/survey/:surveyId — evidências vinculadas a uma pesquisa ─
  router.get('/survey/:surveyId', (req, res) => {
    const all = storage.read('evidences');
    const mine = all.filter(
      (e) => e.accountId === req.account.id && e.surveyId === req.params.surveyId,
    );
    res.json(mine);
  });

  // Error handler local
  router.use((error, _req, res, _next) => {
    console.error('Falha no módulo de evidências:', error.message);
    res.status(500).json({ error: 'Não foi possível processar a evidência.' });
  });

  return router;
}

module.exports = { createRouter };

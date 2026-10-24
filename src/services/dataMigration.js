/**
 * Migração de dados de forma pura, retrocompatível e idempotente.
 * Adapta registros legados para o modelo de segmentos da Fase 1:
 * - Em surveys: segments (null se antigo), participationTarget (0.70)
 * - Em invitations: segmentId (null se antigo), used (boolean), usedDay (YYYY-MM-DD), remove usedAt
 * - Em responses: segmentId (null se antigo), submittedDay (YYYY-MM-DD ou null), remove campos identificadores
 */

function migrateCollection(data) {
  let changed = false;
  const surveys = (data.surveys || []).map(survey => {
    let sChanged = false;
    const s = { ...survey };
    if (s.participationTarget === undefined) {
      s.participationTarget = 0.70;
      sChanged = true;
    }
    if (s.segments === undefined) {
      s.segments = null;
      sChanged = true;
    }
    if (sChanged) changed = true;
    return s;
  });

  const invitations = (data.invitations || []).map(invitation => {
    let iChanged = false;
    const inv = { ...invitation };
    if (inv.segmentId === undefined) {
      inv.segmentId = null;
      iChanged = true;
    }
    if (inv.usedAt !== undefined) {
      inv.used = Boolean(inv.usedAt);
      inv.usedDay = inv.usedAt ? String(inv.usedAt).slice(0, 10) : null;
      delete inv.usedAt;
      iChanged = true;
    } else {
      if (inv.used === undefined) {
        inv.used = false;
        iChanged = true;
      }
      if (inv.usedDay === undefined) {
        inv.usedDay = null;
        iChanged = true;
      }
    }
    if (iChanged) changed = true;
    return inv;
  });

  const responses = (data.responses || []).map(response => {
    let rChanged = false;
    const resp = { ...response };
    if (resp.segmentId === undefined) {
      resp.segmentId = null;
      rChanged = true;
    }
    if (resp.submittedDay === undefined) {
      resp.submittedDay = null;
      rChanged = true;
    }
    if (resp.memberId !== undefined) {
      delete resp.memberId;
      rChanged = true;
    }
    if (resp.ip !== undefined) {
      delete resp.ip;
      rChanged = true;
    }
    if (resp.userAgent !== undefined) {
      delete resp.userAgent;
      rChanged = true;
    }
    if (rChanged) changed = true;
    return resp;
  });

  return {
    changed,
    data: {
      surveys,
      invitations,
      responses
    }
  };
}

function runDataMigration(storage) {
  const current = {
    surveys: storage.read('surveys'),
    invitations: storage.read('invitations'),
    responses: storage.read('responses')
  };

  const result = migrateCollection(current);
  if (result.changed) {
    storage.writeMany({
      surveys: result.data.surveys,
      invitations: result.data.invitations,
      responses: result.data.responses
    });
  }

  return {
    applied: result.changed,
    counts: {
      surveys: result.data.surveys.length,
      invitations: result.data.invitations.length,
      responses: result.data.responses.length
    }
  };
}

module.exports = {
  migrateCollection,
  runDataMigration
};

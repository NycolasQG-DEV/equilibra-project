import {
  DIMENSIONS,
  MIN_GROUP,
  PROTOCOL_VERSION,
  explicitRating,
} from "../ai/protocol";
export type Observation = {
  id: string;
  batchId: string;
  protocolVersion: string;
  history: { kind: string; dimensionTarget: string; userAnswer: unknown }[];
};
export type Batch = {
  id: string;
  title: string;
  sector: string;
  createdAt: string;
  closedAt: string | null;
  protocolVersion: string;
  invited: number;
  completed: number;
};
export function summarize(batch: Batch, observations: Observation[]) {
  const unique = [
    ...new Map(
      observations
        .filter(
          (o) =>
            o.batchId === batch.id && o.protocolVersion === PROTOCOL_VERSION,
        )
        .map((o) => [o.id, o]),
    ).values(),
  ];
  const released =
    !!batch.closedAt &&
    batch.protocolVersion === PROTOCOL_VERSION &&
    unique.length >= MIN_GROUP;
  const dimensions = DIMENSIONS.map((d) => {
    const values = unique
      .map((o) => {
        const entries = o.history.filter(
          (h) => h.kind === "rating" && h.dimensionTarget === d.id,
        );
        return entries.length === 1
          ? explicitRating(entries[0].userAnswer)
          : null;
      })
      .filter((v): v is number => v !== null);
    const adverse = values.filter((v) => v >= 3).length,
      other = values.length - adverse;
    const visible =
      released &&
      values.length >= MIN_GROUP &&
      !(adverse > 0 && adverse < 3) &&
      !(other > 0 && other < 3);
    return {
      id: d.id,
      name: d.name,
      valid: visible ? values.length : null,
      unfavorable: visible ? adverse : null,
      percent: visible
        ? Math.round((adverse / values.length) * 1000) / 10
        : null,
      reference: batch.id + ":" + d.id,
      action: d.action,
    };
  });
  return {
    ...batch,
    released,
    reason: !batch.closedAt
      ? "collection"
      : !released
        ? "insufficient"
        : "released",
    dimensions,
  };
}
export type Snapshot = ReturnType<typeof summarize>;
export function comparison(current: Snapshot, previous?: Snapshot) {
  return current.dimensions.map((d) => {
    const prior = previous?.dimensions.find((p) => p.id === d.id);
    const comparable =
      !!previous?.closedAt &&
      !!current.closedAt &&
      previous.sector === current.sector &&
      previous.protocolVersion === current.protocolVersion &&
      new Date(previous.closedAt) < new Date(current.closedAt);
    return {
      id: d.id,
      delta:
        comparable &&
        d.percent !== null &&
        prior?.percent !== null &&
        prior?.percent !== undefined
          ? Math.round((d.percent - prior.percent) * 10) / 10
          : null,
    };
  });
}
export function priorities(batch: Snapshot) {
  return batch.dimensions
    .filter((d) => d.percent !== null && d.percent > 0)
    .sort((a, b) => b.percent! - a.percent! || a.id.localeCompare(b.id));
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

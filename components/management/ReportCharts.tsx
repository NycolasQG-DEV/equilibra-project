"use client";
import { useState } from "react";
import { Snapshot, comparison } from "@/lib/management/analytics";
import { DIMENSIONS } from "@/lib/ai/protocol";
const format = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export function Evolution({ batches }: { batches: Snapshot[] }) {
  const [dim, setDim] = useState<string>(DIMENSIONS[0].id);
  const rows = batches
    .filter((b) => b.closedAt)
    .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  const points = rows.map((b, i) => ({
    batch: b,
    value: b.dimensions.find((d) => d.id === dim)?.percent ?? null,
    x: 56 + i * (600 / Math.max(1, rows.length - 1)),
  }));
  return (
    <section className="eq-panel">
      <div className="eq-panel-heading">
        <div>
          <p className="eq-eyebrow">AO LONGO DO TEMPO</p>
          <h2>Evolução das condições</h2>
        </div>
        <select
          aria-label="Tema da evolução"
          className="eq-select"
          value={dim}
          onChange={(e) => setDim(e.target.value)}
        >
          {DIMENSIONS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {rows.length < 2 ? (
        <div className="eq-chart-empty">
          <span className="material-symbols-outlined">timeline</span>
          <h3>A série começa com duas rodadas</h3>
          <p>
            Encerre outra campanha do mesmo setor para comparar este tema ao
            longo do tempo.
          </p>
        </div>
      ) : (
        <>
          <div className="eq-chart-wrap">
            <svg
              viewBox="0 0 720 265"
              role="img"
              aria-label="Percentual de respostas frequentes por rodada. Os valores estão na tabela abaixo."
            >
              {[0, 25, 50, 75, 100].map((n) => (
                <g key={n}>
                  <line
                    x1="52"
                    x2="673"
                    y1={211 - n * 1.65}
                    y2={211 - n * 1.65}
                    stroke="#ece9f1"
                    strokeDasharray={n === 0 ? undefined : "3 5"}
                  />
                  <text x="8" y={215 - n * 1.65} fill="#8b8398" fontSize="11">
                    {n}%
                  </text>
                </g>
              ))}
              {points.map((p, i) => {
                const last = points[i - 1];
                return (
                  <g key={p.batch.id}>
                    {p.value !== null && last?.value != null && (
                      <line
                        x1={last.x}
                        y1={211 - last.value * 1.65}
                        x2={p.x}
                        y2={211 - p.value * 1.65}
                        stroke="#8050d5"
                        strokeWidth="3"
                      />
                    )}
                    {p.value !== null ? (
                      <>
                        <circle
                          cx={p.x}
                          cy={211 - p.value * 1.65}
                          r="6"
                          fill="#8050d5"
                          stroke="white"
                          strokeWidth="3"
                        />
                        <text
                          x={p.x}
                          y={195 - p.value * 1.65}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="600"
                          fill="#5b3395"
                        >
                          {format(p.value)}%
                        </text>
                      </>
                    ) : (
                      <text
                        x={p.x}
                        y="206"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#8b8398"
                      >
                        Protegido
                      </text>
                    )}
                    <text
                      x={p.x}
                      y="242"
                      textAnchor="middle"
                      fontSize="11"
                      fill="#8b8398"
                    >
                      {new Date(p.batch.closedAt!).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <details className="eq-chart-details">
            <summary>Consultar valores e bases por rodada</summary>
            <table className="eq-table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Respostas frequentes / válidas</th>
                  <th>Percentual</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => {
                  const d = p.batch.dimensions.find((d) => d.id === dim)!;
                  return (
                    <tr key={p.batch.id}>
                      <td>{p.batch.title}</td>
                      <td>
                        {d.valid === null
                          ? "Protegido"
                          : d.unfavorable + " / " + d.valid}
                      </td>
                      <td>{p.value === null ? "—" : format(p.value) + "%"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </>
      )}
      <p className="eq-footnote">
        Quanto menor, menos frequente a condição desfavorável. A composição da
        equipe pode variar entre rodadas; a mudança não prova efeito de uma
        medida.
      </p>
    </section>
  );
}
export function Heatmap({ batches }: { batches: Snapshot[] }) {
  const rows = batches
    .filter((b) => b.closedAt)
    .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!))
    .slice(-6);
  return (
    <section className="eq-panel">
      <div className="eq-panel-heading">
        <div>
          <p className="eq-eyebrow">LEITURA POR TEMA E PERÍODO</p>
          <h2>Mapa de atenção</h2>
        </div>
        <span className="eq-badge">Últimas 6 rodadas</span>
      </div>
      {!rows.length ? (
        <div className="eq-chart-empty">
          <h3>Aguardando uma rodada encerrada</h3>
          <p>
            Este mapa mostra onde as condições se repetem e onde estão mudando.
          </p>
        </div>
      ) : (
        <div className="eq-table-scroll">
          <table className="eq-heatmap">
            <thead>
              <tr>
                <th>Tema</th>
                {rows.map((b) => (
                  <th key={b.id}>
                    <span>{b.title}</span>
                    <small>
                      {new Date(b.closedAt!).toLocaleDateString("pt-BR")}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.id}>
                  <th>{d.name}</th>
                  {rows.map((b) => {
                    const f = b.dimensions.find((x) => x.id === d.id)!;
                    return (
                      <td key={b.id}>
                        <div
                          className={
                            "eq-heat-cell " +
                            (f.percent === null ? "is-protected" : "")
                          }
                          style={
                            f.percent === null
                              ? {}
                              : {
                                  background:
                                    "hsl(264 57% " +
                                    (96 - f.percent * 0.53) +
                                    "%)",
                                  color: f.percent >= 60 ? "white" : "#4d2b7b",
                                }
                          }
                          title={
                            f.percent === null
                              ? "Resultado protegido"
                              : f.unfavorable +
                                " de " +
                                f.valid +
                                " respostas válidas"
                          }
                        >
                          {f.percent === null ? (
                            <span aria-label="Protegido">—</span>
                          ) : (
                            <>
                              {format(f.percent)}
                              <small>%</small>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="eq-heat-legend">
        <span>Menor frequência</span>
        <i />
        <span>Maior frequência</span>
        <span className="eq-muted">— Dado protegido</span>
      </div>
      <p className="eq-footnote">
        A intensidade representa frequência relatada, não uma classificação
        técnica de risco ocupacional.
      </p>
    </section>
  );
}
export function PeriodComparison({
  batch,
  previous,
}: {
  batch: Snapshot;
  previous?: Snapshot;
}) {
  const delta = comparison(batch, previous);
  return (
    <section className="eq-panel">
      <div className="eq-panel-heading">
        <div>
          <p className="eq-eyebrow">COMPARAÇÃO ENTRE RODADAS</p>
          <h2>O que mudou</h2>
        </div>
        <div className="eq-chart-key">
          <span>
            <i style={{ background: "#ddd2ef" }} />
            Anterior
          </span>
          <span>
            <i style={{ background: "#8152c8" }} />
            Atual
          </span>
        </div>
      </div>
      <div className="eq-comparison-list">
        {batch.dimensions.map((d) => {
          const before = previous?.dimensions.find((x) => x.id === d.id),
            change = delta.find((x) => x.id === d.id)?.delta;
          return (
            <div key={d.id} className="eq-comparison-row">
              <div>
                <strong>{d.name}</strong>
                <span
                  className={
                    change == null
                      ? "eq-muted"
                      : change < 0
                        ? "eq-change down"
                        : change > 0
                          ? "eq-change up"
                          : "eq-muted"
                  }
                >
                  {change == null
                    ? "Sem comparação"
                    : (change > 0 ? "+" : "") + format(change) + " p.p."}
                </span>
              </div>
              <div className="eq-paired-bars">
                <div>
                  <span
                    style={{
                      width: (before?.percent ?? 0) + "%",
                      background: "#ddd2ef",
                    }}
                  />
                </div>
                <div>
                  <span
                    style={{
                      width: (d.percent ?? 0) + "%",
                      background: "#8152c8",
                    }}
                  />
                </div>
              </div>
              <span className="eq-comparison-value">
                {d.percent === null ? "Protegido" : format(d.percent) + "%"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="eq-footnote">
        Base anterior: {previous?.title || "nenhuma campanha comparável"}.
        Diferença em pontos percentuais, somente quando ambos os resultados são
        divulgáveis.
      </p>
    </section>
  );
}

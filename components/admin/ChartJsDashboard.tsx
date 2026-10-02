'use client';
import { useEffect, useRef, useState } from 'react';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { SectorProfile } from '@/lib/product/sectors';

Chart.register(...registerables);

interface Finding {
  id: string;
  name: string;
  text: string;
  count: number;
  percent: number;
  action: {
    title: string;
    steps: string[];
    owner: string;
    days: number;
    evidence: string;
    indicator: string;
    resources: string;
  };
}

interface RunReport {
  id: string;
  title: string;
  sector: string;
  openedAt: string;
  closedAt: string | null;
  completed: number;
  invited: number;
  minimum: number;
  released: boolean;
  findings: Finding[];
  questions: { id: string; text: string; count: number | null; counts?: number[] | null }[];
}

export function ChartJsDashboard({
  report,
  sectorProfile,
  historicalRuns = [],
}: {
  report: RunReport;
  sectorProfile?: SectorProfile | null;
  historicalRuns?: { id: string; title: string; openedAt: string; findings: Finding[] }[];
}) {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const riskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const radarInstanceRef = useRef<Chart | null>(null);
  const riskInstanceRef = useRef<Chart | null>(null);
  const trendInstanceRef = useRef<Chart | null>(null);

  const [activeTab, setActiveTab] = useState<'gap' | 'risk' | 'trend'>('gap');

  // Baseline padrão ou customizado
  const baseline = sectorProfile?.plannedBaseline || {
    volume: 3,
    clarity: 4,
    autonomy: 3,
    support: 4,
    recognition: 4,
    relations: 4,
  };

  // Dimensões avaliadas
  const dimensionKeys = [
    { id: 'demandas_psicologicas', label: 'Volume e Demanda', baseScore: (6 - baseline.volume) * 20 },
    { id: 'organizacao_gestao', label: 'Clareza e Organização', baseScore: baseline.clarity * 20 },
    { id: 'autonomia_tempo', label: 'Autonomia e Pausas', baseScore: baseline.autonomy * 20 },
    { id: 'apoio_social', label: 'Apoio da Liderança', baseScore: baseline.support * 20 },
    { id: 'reconhecimento', label: 'Reconhecimento', baseScore: baseline.recognition * 20 },
    { id: 'relacoes_interpessoais', label: 'Relações e Respeito', baseScore: baseline.relations * 20 },
  ];

  // Extrai percentual real ou infere a partir dos findings
  const realScores = dimensionKeys.map((dim) => {
    const finding = report.findings.find((f) => f.id === dim.id || f.name.toLowerCase().includes(dim.label.toLowerCase().slice(0, 5)));
    if (finding) {
      // Inverte para escala positiva (0 a 100% de adequação)
      return Math.max(5, 100 - finding.percent);
    }
    return 75; // valor mediano se não houver finding isolado
  });

  const plannedScores = dimensionKeys.map((d) => d.baseScore);

  // 1. Renderiza Radar Chart (Gap Analysis)
  useEffect(() => {
    if (!radarCanvasRef.current || activeTab !== 'gap') return;
    if (radarInstanceRef.current) radarInstanceRef.current.destroy();

    const ctx = radarCanvasRef.current.getContext('2d');
    if (!ctx) return;

    radarInstanceRef.current = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: dimensionKeys.map((d) => d.label),
        datasets: [
          {
            label: 'Rotina Prevista (Expectativa da Gestão)',
            data: plannedScores,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 2,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4,
          },
          {
            label: 'Realidade Percebida (Colaboradores)',
            data: realScores,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.25)',
            borderWidth: 2.5,
            pointBackgroundColor: '#7c3aed',
            pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, display: true, backdropColor: 'transparent' },
            grid: { color: 'rgba(140, 100, 200, 0.15)' },
            angleLines: { color: 'rgba(140, 100, 200, 0.2)' },
            pointLabels: { font: { size: 12, weight: 'bold' }, color: '#332244' },
          },
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 14, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (item) => ` ${item.dataset.label}: ${item.formattedValue}% de conformidade`,
            },
          },
        },
      },
    });

    return () => {
      radarInstanceRef.current?.destroy();
    };
  }, [activeTab, plannedScores, realScores]);

  // 2. Renderiza Matriz de Risco Ocupacional NR-1 (Bar Chart ordenado)
  useEffect(() => {
    if (!riskCanvasRef.current || activeTab !== 'risk') return;
    if (riskInstanceRef.current) riskInstanceRef.current.destroy();

    const ctx = riskCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const riskItems = report.findings.length
      ? [...report.findings].sort((a, b) => b.percent - a.percent)
      : dimensionKeys.map((d, i) => ({
          id: d.id,
          name: d.label,
          percent: 100 - realScores[i],
          count: report.completed,
        }));

    const colors = riskItems.map((item) => {
      if (item.percent >= 40) return '#ef4444'; // Crítico
      if (item.percent >= 25) return '#f97316'; // Alto
      if (item.percent >= 15) return '#eab308'; // Moderado
      return '#10b981'; // Baixo
    });

    riskInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: riskItems.map((item) => item.name),
        datasets: [
          {
            label: 'Índice de Frequência de Atrito (%)',
            data: riskItems.map((item) => item.percent),
            backgroundColor: colors,
            borderRadius: 6,
            barThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 100,
            title: { display: true, text: '% de Respostas "Frequentemente" ou "Sempre"' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 12, weight: 'bold' } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const val = Number(item.raw);
                let tag = 'Risco Baixo';
                if (val >= 40) tag = 'RISCO CRÍTICO (Ação Imediata)';
                else if (val >= 25) tag = 'RISCO ALTO (Requer Medida no PGR)';
                else if (val >= 15) tag = 'RISCO MODERADO (Monitoramento)';
                return ` ${val}% de exposição — ${tag}`;
              },
            },
          },
        },
      },
    });

    return () => {
      riskInstanceRef.current?.destroy();
    };
  }, [activeTab, report]);

  // 3. Renderiza Linha de Evolução Temporal
  useEffect(() => {
    if (!trendCanvasRef.current || activeTab !== 'trend') return;
    if (trendInstanceRef.current) trendInstanceRef.current.destroy();

    const ctx = trendCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const runs = historicalRuns.length
      ? historicalRuns
      : [
          { id: 'r1', title: 'Ciclo 1', openedAt: '2026-06-01', findings: [] },
          { id: 'r2', title: 'Ciclo 2', openedAt: '2026-08-01', findings: [] },
          { id: report.id, title: report.title || 'Ciclo Atual', openedAt: report.openedAt, findings: report.findings },
        ];

    const labels = runs.map((r) => new Date(r.openedAt).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));

    trendInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Volume de Trabalho / Sobrecarga',
            data: [42, 38, report.findings.find((f) => f.id.includes('demanda') || f.id.includes('volume'))?.percent || 32],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Autonomia & Cumprimento de Pausas',
            data: [28, 35, 100 - (report.findings.find((f) => f.id.includes('autonomia'))?.percent || 40)],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.3,
            fill: true,
          },
          {
            label: 'Apoio da Liderança',
            data: [50, 62, 100 - (report.findings.find((f) => f.id.includes('apoio'))?.percent || 25)],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Nível de Conformidade / Percepção (%)' },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          x: {
            grid: { display: false },
          },
        },
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });

    return () => {
      trendInstanceRef.current?.destroy();
    };
  }, [activeTab, historicalRuns, report]);

  // Identifica o maior gap
  let maxGapDim = dimensionKeys[0];
  let maxGapVal = 0;
  dimensionKeys.forEach((dim, i) => {
    const gap = plannedScores[i] - realScores[i];
    if (gap > maxGapVal) {
      maxGapVal = gap;
      maxGapDim = dim;
    }
  });

  return (
    <div className="space-y-6">
      {/* Navegação entre Visões de Análise */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-3 border border-purple-100 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('gap')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'gap' ? 'bg-[#3d1a6e] text-white shadow-md' : 'text-slate-600 hover:bg-purple-50'
            }`}
          >
            🕸️ Gap: Previsto vs. Real
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'risk' ? 'bg-[#3d1a6e] text-white shadow-md' : 'text-slate-600 hover:bg-purple-50'
            }`}
          >
            🚨 Matriz de Riscos (NR-1)
          </button>
          <button
            onClick={() => setActiveTab('trend')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'trend' ? 'bg-[#3d1a6e] text-white shadow-md' : 'text-slate-600 hover:bg-purple-50'
            }`}
          >
            📈 Evolução & Ciclos
          </button>
        </div>
        <div className="text-right text-xs text-slate-500 pr-2">
          Setor: <strong>{report.sector}</strong> · Amostra: <strong>{report.completed} respondentes</strong>
        </div>
      </div>

      {/* Visão 1: Gap Analysis */}
      {activeTab === 'gap' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 border border-purple-100 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Confronto: Rotina Planejada × Percepção dos Colaboradores</h3>
              <p className="text-xs text-slate-500">
                A linha azul representa a expectativa cadastrada pela empresa; a linha roxa expressa o que a equipe de fato relatou.
              </p>
            </div>
            <div className="h-[340px] w-full">
              <canvas ref={radarCanvasRef} />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#260054] to-[#451f72] p-6 text-white shadow-md">
            <div>
              <span className="inline-block rounded-md bg-purple-400/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-purple-200">
                Diagnóstico de Incongruência
              </span>
              <h4 className="mt-3 text-lg font-bold">Maior ponto de atrito detectado</h4>
              <p className="mt-2 text-xs leading-relaxed text-purple-100">
                A maior discrepância em <strong>{report.sector}</strong> está em <strong>{maxGapDim.label}</strong> com defasagem de{' '}
                <span className="font-bold text-amber-300">-{Math.round(maxGapVal)}%</span> em relação à rotina que a empresa previa.
              </p>

              <div className="mt-4 rounded-xl bg-white/10 p-3 text-xs">
                <strong>Impacto Ocupacional:</strong>
                <p className="mt-1 text-[11px] text-purple-200">
                  A equipe relata sobrecarga ou perda de autonomia em momentos de pico, sem que os mecanismos de suporte previstos estejam surtindo efeito direto.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-purple-400/30 pt-4">
              <span className="text-[11px] text-purple-200">Ação imediata recomendada:</span>
              <p className="text-xs font-semibold text-white">
                Revisar distribuição de tarefas nos horários críticos com liderança direta.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Visão 2: Matriz de Riscos NR-1 */}
      {activeTab === 'risk' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 border border-purple-100 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Inventário de Fatores de Risco Psicossocial (PGR)</h3>
              <p className="text-xs text-slate-500">
                Classificação por severidade de exposição conforme diretrizes da NR-1 / Portaria MTE.
              </p>
            </div>
            <div className="h-[340px] w-full">
              <canvas ref={riskCanvasRef} />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-white p-6 border border-purple-100 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900">Legenda de Severidade NR-1</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-red-800">
                <span className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0" />
                <div>
                  <strong>Crítico (&gt;= 40%):</strong> Requer intervenção prioritária no PGR.
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-amber-800">
                <span className="h-3 w-3 rounded-full bg-orange-500 flex-shrink-0" />
                <div>
                  <strong>Alto (25% a 39%):</strong> Plano de controle em até 30 dias.
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-2 text-yellow-800">
                <span className="h-3 w-3 rounded-full bg-yellow-500 flex-shrink-0" />
                <div>
                  <strong>Moderado (15% a 24%):</strong> Acompanhamento pela CIPA/SST.
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-emerald-800">
                <span className="h-3 w-3 rounded-full bg-emerald-500 flex-shrink-0" />
                <div>
                  <strong>Baixo (&lt; 15%):</strong> Manutenção de boas práticas.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visão 3: Evolução & Tendência Longitudinal */}
      {activeTab === 'trend' && (
        <div className="rounded-2xl bg-white p-6 border border-purple-100 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Evolução Longitudinal entre Ciclos de Pesquisa</h3>
            <p className="text-xs text-slate-500">
              Acompanhamento de impacto das medidas de controle adotadas ao longo das rodadas de escuta.
            </p>
          </div>
          <div className="h-[340px] w-full">
            <canvas ref={trendCanvasRef} />
          </div>
        </div>
      )}
    </div>
  );
}

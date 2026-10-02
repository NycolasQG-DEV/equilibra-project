import { Snapshot, priorities, comparison } from "./analytics";
import { structuredCompletion } from "../ai/groq-service";
import { SYSTEM_REPORT_PROMPT, SYSTEM_MANAGER_PROMPT } from "../ai/prompts";
import { reportContract, managerContract, minimizeText } from "../ai/contracts";
export async function insights(batch: Snapshot) {
  const eligible = priorities(batch),
    ids = eligible.map((d) => d.id);
  const selection = ids.length
    ? await structuredCompletion(
        SYSTEM_REPORT_PROMPT,
        {
          eligible_dimensions: ids,
          findings: eligible.map((d) => ({
            id: d.id,
            percent: d.percent,
            valid: d.valid,
            action: d.action.title,
          })),
        },
        (v) => reportContract(v, ids),
      )
    : null;
  // Selection can change order only. A model cannot suppress a stronger signal or insert a new finding.
  const top = eligible.slice(0, 3);
  const orderedTop = selection
    ? top.slice().sort((a, b) => {
        const ai = selection.dimension_ids.indexOf(a.id),
          bi = selection.dimension_ids.indexOf(b.id);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })
    : top;
  const ordered = [...orderedTop, ...eligible.slice(3)];
  return {
    batchId: batch.id,
    source: selection ? "ai_assisted" : "rules",
    summary: !batch.released
      ? "Encerre a campanha e reúna pelo menos 10 participações válidas para consultar resultados coletivos."
      : !batch.dimensions.some((d) => d.percent !== null)
        ? "Os resultados por tema estão protegidos. Não há base divulgável para recomendar medidas a partir desta rodada."
        : eligible.length
          ? "Comece pelos temas abaixo. Verifique as condições reais com a equipe antes de aprovar as medidas."
          : "Os indicadores divulgáveis não apontaram respostas frequentes nas condições investigadas. Isso não comprova ausência de riscos.",
    findings: ordered.map((d) => ({
      id: d.id,
      name: d.name,
      evidence:
        d.unfavorable +
        " de " +
        d.valid +
        " respostas válidas (" +
        d.percent +
        "%) indicaram Frequentemente ou Sempre.",
      reference: d.reference,
      action: d.action,
    })),
    limitations:
      "Sugestões de organização do trabalho sujeitas à avaliação e aprovação humana. Não são diagnóstico, laudo ou certificado de conformidade.",
  };
}
export async function managerAnswer(
  question: string,
  batches: Snapshot[],
  actions: any[],
) {
  const batch = batches
    .filter((b) => b.closedAt)
    .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!))
    .at(-1);
  if (!batch)
    return {
      text: "Ainda não há campanha encerrada. Crie uma campanha, distribua os links e encerre a coleta para analisar os resultados coletivos.",
      source: "rules",
    };
  const dims = batch.dimensions.filter((d) => d.percent !== null);
  const choice = await structuredCompletion(
    SYSTEM_MANAGER_PROMPT,
    {
      question: minimizeText(question, 1200),
      eligible_dimensions: dims.map((d) => d.id),
    },
    (v) =>
      managerContract(
        v,
        dims.map((d) => d.id),
      ),
  );
  const lower = question.toLocaleLowerCase("pt-BR");
  const intent =
    choice?.intent ||
    (lower.includes("evolu") || lower.includes("tempo")
      ? "trend"
      : lower.includes("aç") || lower.includes("melhor")
        ? "actions"
        : lower.includes("amostra")
          ? "quality"
          : lower.includes("conform")
            ? "limits"
            : "overview");
  let text = "";
  if (intent === "limits")
    text =
      "A pesquisa reúne percepções sobre condições de trabalho. Para gerir riscos conforme a NR-1, a organização precisa avaliar os perigos e riscos com critérios documentados, manter o inventário e acompanhar seu plano de ação. Este painel contribui com evidências; não certifica conformidade.";
  else if (intent === "quality")
    text =
      batch.title +
      ": " +
      batch.completed +
      " participações concluídas de " +
      batch.invited +
      " links. Resultados só aparecem após o encerramento, com ao menos 10 participantes válidos por tema e proteção de contagens pequenas. Não responder não equivale a uma resposta favorável.";
  else if (intent === "actions") {
    const data = await insights(batch);
    text =
      data.findings
        .map(
          (f) =>
            f.name +
            ": " +
            f.evidence +
            " Sugestão: " +
            f.action.title +
            ". Responsável sugerido: " +
            f.action.owner +
            ". Verificação: " +
            f.action.indicator +
            ". Referência: " +
            f.reference,
        )
        .join("\n\n") || data.summary;
    text +=
      "\n\nExistem " +
      actions.filter((a) => a.status !== "done").length +
      " ações em aberto. Defina responsável, prazo e evidência no plano de ação.";
  } else if (intent === "trend") {
    const previous = batches
      .filter(
        (b) =>
          b.closedAt &&
          b.sector === batch.sector &&
          new Date(b.closedAt) < new Date(batch.closedAt!),
      )
      .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!))
      .at(-1);
    const diff = comparison(batch, previous).filter(
      (d) =>
        d.delta !== null &&
        (!choice?.dimension_id || d.id === choice.dimension_id),
    );
    text = diff.length
      ? diff
          .map(
            (d) =>
              dims.find((x) => x.id === d.id)?.name +
              ": " +
              (d.delta! > 0 ? "+" : "") +
              d.delta +
              " pontos percentuais em relação a " +
              previous!.title +
              ".",
          )
          .join("\n") +
        "\nAs rodadas podem incluir pessoas diferentes; a variação não demonstra efeito de uma ação."
      : "Ainda não há duas rodadas comparáveis e divulgáveis para este setor e instrumento.";
  } else {
    text =
      dims
        .filter((d) => !choice?.dimension_id || d.id === choice.dimension_id)
        .map(
          (d) =>
            d.name +
            ": " +
            d.percent +
            "% (" +
            d.unfavorable +
            "/" +
            d.valid +
            ") responderam Frequentemente ou Sempre. Referência: " +
            d.reference +
            ".",
        )
        .join("\n") ||
      "Os resultados desta campanha estão protegidos por tamanho de grupo ou contagens pequenas.";
  }
  return { text, source: choice ? "ai_assisted" : "rules" };
}

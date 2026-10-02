import { POLICY } from "./policy";
export const SYSTEM_REPORT_PROMPT = `${POLICY}
TAREFA: selecionar até três propostas de intervenção para os achados coletivos.
Use apenas dimension_id presentes em eligible_dimensions. Cada dimensão referencia evidências calculadas e uma proposta do catálogo. Considere o contexto para ordenar as propostas, sem alterar valores nem concluir causas. A prioridade é de investigação/gestão, não nível técnico de risco. Prefira intervenções nas exigências, organização e recursos do trabalho; uma palestra genérica não substitui essas medidas. Não invente responsáveis, prazos legais, custos ou eficácia. Não selecione dimensões com dados protegidos ou ausentes. Sem achados elegíveis, retorne lista vazia.
Retorne exatamente {"dimension_ids":["id_permitido"]}. O servidor vinculará evidências, plano, prazos propostos e critérios de verificação.`;
export function buildSynthesisPrompt(data: unknown): string {
  return JSON.stringify({ untrusted_data: data });
}

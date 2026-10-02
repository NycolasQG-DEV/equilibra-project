export type Question = { id: string; type: "likert" | "text"; text: string };
export type SurveyKind = "master" | "custom";
export const LIKERT = ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"] as const;

export function privacyWarnings(questions: Question[]): string[] {
  return questions.flatMap((question, index) =>
    /\b(nome|e-mail|email|cpf|matr[ií]cula|telefone|endere[cç]o|cargo exclusivo|identifique|quem foi)\b/i.test(question.text)
      ? [`Pergunta ${index + 1} pode solicitar dados que identifiquem pessoas.`]
      : [],
  );
}

/**
 * Módulo de Moderação, Segurança e Conformidade Ético-Legal (Groq Safety & LGPD)
 * Valida mensagens recebidas e emitidas para impedir conteúdo ilícito, criminoso,
 * ameaças, violações das políticas da IA e desvios de finalidade da NR-1 / LGPD.
 */

const SEVERE_VIOLATION_PATTERNS = [
  /\b(matar|assassinar|esfaquear|envenenar|bomba|terrorismo|terrorista)\b/i,
  /\b(sabotagem|sabotar|explodir|incendiar|queimar a fabrica|destruir maquina de proposito)\b/i,
  /\b(trafico|entorpecente|cocaina|droga ilicita|vender arma)\b/i,
  /\b(estupro|pedofilia|abuso de menor)\b/i,
  /\b(me matar|suicidio|cortar meus pulsos|tirar minha vida)\b/i,
  /\b(hackear|invadir sistema|roubar senhas|desviar dinheiro)\b/i
];

export interface SafetyValidationResult {
  isSafe: boolean;
  reason?: string;
  warningStatement?: string;
  warningQuestion?: string;
}

export const SafetyGuard = {
  validateUserInput(text: string): SafetyValidationResult {
    if (!text || typeof text !== 'string') {
      return { isSafe: true };
    }

    const trimmed = text.trim();

    // Detecção de ideação suicida / automutilação
    if (/\b(me matar|suicidio|cortar meus pulsos|tirar minha vida)\b/i.test(trimmed)) {
      return {
        isSafe: false,
        reason: 'self_harm_risk',
        warningStatement: 'Sua vida e seu bem-estar são preciosos e estamos aqui para apoiar você. Se estiver passando por um momento de sofrimento intenso, procure apoio imediato no CVV pelo telefone 188 (ligação gratuita 24h) ou informe o serviço de saúde da empresa.',
        warningQuestion: 'Podemos continuar nossa conversa com foco no seu posto e na sua rotina de trabalho?'
      };
    }

    // Detecção de ameaça criminosa / ilícitos graves
    for (const pattern of SEVERE_VIOLATION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSafe: false,
          reason: 'illegal_content_policy',
          warningStatement: 'Identificamos conteúdos ou menções que violam nossas diretrizes de segurança, o Código Penal e as políticas de uso da IA.',
          warningQuestion: 'Este canal é dedicado exclusivamente ao diálogo sobre saúde, ergonomia e segurança no trabalho (NR-1) protegido pela LGPD. Podemos focar no seu dia a dia no setor?'
        };
      }
    }

    return { isSafe: true };
  },

  validateAiOutput(stepData: any): any {
    if (!stepData) return stepData;

    const statement = stepData.bot_statement || '';
    const question = stepData.next_question || '';

    for (const pattern of SEVERE_VIOLATION_PATTERNS) {
      if (pattern.test(statement) || pattern.test(question)) {
        return {
          ...stepData,
          bot_statement: 'Compreendo a importância de mantermos um ambiente seguro, saudável e acolhedor para todos.',
          next_question: 'Como você percebe o ritmo e a segurança geral no seu setor atualmente?'
        };
      }
    }

    return stepData;
  }
};

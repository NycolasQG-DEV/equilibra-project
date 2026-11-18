import React, { useEffect, useRef, useState } from 'react';
import { get, post } from '../core/api';

export interface Question {
  id: string;
  label?: string;
  text: string;
  options: string[];
}

export interface RespondViewProps {
  token: string;
  surveyTitle?: string;
  questions?: Question[];
  onSubmit?: (answers: Record<string, number>) => Promise<void>;
}

interface SurveyData {
  title: string;
  model: string;
  instrument: { id: string; version: string; name: string };
  instructions?: string;
  limitation?: string;
  options: string[];
  factors: Array<{ key: string; label: string; question: string }>;
  groupName?: string;
}

export const RespondView: React.FC<RespondViewProps> = ({
  token,
  surveyTitle: initialTitle,
  questions: initialQuestions,
  onSubmit: propOnSubmit,
}) => {
  const [loading, setLoading] = useState(!initialQuestions || initialQuestions.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [surveyTitle, setSurveyTitle] = useState(initialTitle || 'Pesquisa de Escuta Ativa');
  const [questions, setQuestions] = useState<Question[]>(initialQuestions || []);
  const [optionsList, setOptionsList] = useState<string[]>([
    'Nunca',
    'Raramente',
    'Às vezes',
    'Frequentemente',
    'Sempre',
  ]);

  const [currentStep, setCurrentStep] = useState(-1); // -1 = boas-vindas
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mode, setMode] = useState<'dialogue' | 'standard'>('dialogue');
  const [displayedText, setDisplayedText] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const anime = (window as any).anime;

  // Carregar dados da pesquisa a partir do token caso não tenham sido passados
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setLoading(false);
      return;
    }

    if (!token) {
      setErrorMsg('Token de convite não informado.');
      setLoading(false);
      return;
    }

    async function fetchSurvey() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await get<SurveyData>(`/respond/${token}`);
        if (data && Array.isArray(data.factors)) {
          setSurveyTitle(data.title || 'Pesquisa de Escuta Ativa');
          if (Array.isArray(data.options) && data.options.length > 0) {
            setOptionsList(data.options);
          }
          const mapped: Question[] = data.factors.map((f) => ({
            id: f.key,
            label: f.label,
            text: f.question,
            options: data.options || ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'],
          }));
          setQuestions(mapped);
        } else {
          setErrorMsg('Não foi possível carregar as perguntas desta pesquisa.');
        }
      } catch (err: any) {
        const msg = err?.data?.error || err?.message || 'Link inválido ou pesquisa indisponível.';
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [token, initialQuestions]);

  // Efeito de digitação suave
  useEffect(() => {
    if (currentStep < 0 || currentStep >= questions.length || mode !== 'dialogue') {
      return;
    }

    const currentQuestion = questions[currentStep];
    const fullText = currentQuestion.text;
    setDisplayedText('');

    let index = 0;
    let timer: NodeJS.Timeout;

    function typeChar() {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        const char = fullText[index];
        index++;

        let delay = 30;
        if (char === ',' || char === ';') delay += 80;
        else if (char === '.' || char === '!' || char === '?') delay += 150;
        else if (char === ' ') delay += 10;

        timer = setTimeout(typeChar, delay);
      }
    }

    timer = setTimeout(typeChar, 80);
    return () => clearTimeout(timer);
  }, [currentStep, mode, questions]);

  // Animação suave com Anime.js
  useEffect(() => {
    if (!anime || mode !== 'dialogue') return;

    if (cardRef.current) {
      anime({
        targets: cardRef.current,
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 400,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      });
    }

    if (optionsRef.current) {
      const pills = optionsRef.current.querySelectorAll('.dialogue-pill-option');
      if (pills.length > 0) {
        anime({
          targets: pills,
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 380,
          delay: anime.stagger(45, { start: 160 }),
          easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        });
      }
    }
  }, [currentStep, mode]);

  const handleSelectOption = (questionId: string, score: number) => {
    setSelectedScore(score);
    const updated = { ...answers, [questionId]: score };
    setAnswers(updated);

    if (anime && optionsRef.current) {
      const activeBtn = optionsRef.current.querySelector(`[data-score="${score}"]`);
      if (activeBtn) {
        anime({
          targets: activeBtn,
          scale: [1, 0.95, 1.02, 1],
          duration: 300,
          easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        });
      }
    }

    setTimeout(() => {
      setSelectedScore(null);
      setCurrentStep((prev) => prev + 1);
    }, 320);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (propOnSubmit) {
        await propOnSubmit(answers);
      } else {
        await post(`/respond/${token}`, { answers });
      }
      setIsSubmitted(true);
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'Erro ao enviar respostas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
        <div className="card p-8 text-center max-w-sm bg-surface">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <i className="fa-solid fa-spinner fa-spin text-primary text-xl" aria-hidden="true" />
          </div>
          <p className="font-semibold text-sm">Carregando pesquisa...</p>
          <p className="text-xs color-text-muted mt-1">Garantindo conexão segura e confidencial.</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
        <div className="card p-8 text-center max-w-md bg-surface shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center text-danger">
            <i className="fa-solid fa-triangle-exclamation text-2xl" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-primary mb-2">Convite Indisponível</h1>
          <p className="text-sm color-text-secondary mb-6">{errorMsg}</p>
          <p className="text-xs color-text-muted">
            Se você acredita que isto é um engano, solicite um novo link ao responsável pelo RH/SST da sua empresa.
          </p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
        <div className="card p-8 text-center max-w-md bg-surface shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center text-success">
            <i className="fa-solid fa-circle-check text-3xl" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-primary mb-2">Resposta Enviada com Sucesso!</h1>
          <p className="text-sm color-text-secondary mb-4 leading-relaxed">
            Agradecemos sua colaboração confidencial. Suas percepções auxiliam diretamente na melhoria contínua das
            condições e da organização do trabalho.
          </p>
          <div className="p-3 bg-surface-subtle rounded-lg text-xs color-text-muted">
            <i className="fa-solid fa-shield-halved mr-1 text-primary" aria-hidden="true" />
            Proteção de dados ativa conforme a LGPD e regras de confidencialidade da NR-1.
          </div>
        </div>
      </div>
    );
  }

  // 1. Tela de Boas-Vindas (-1)
  if (currentStep === -1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
        <div className="card p-8 max-w-lg bg-surface shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <i className="fa-solid fa-comments text-2xl" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-primary mb-2">{surveyTitle}</h1>
          <p className="text-sm color-text-secondary mb-6 leading-relaxed">
            Este espaço é dedicado a ouvir sua percepção sobre a rotina de trabalho.
            Suas respostas são <strong>estritamente confidenciais</strong> e serão consolidadas apenas em médias coletivas.
          </p>

          <div className="bg-surface-subtle p-4 rounded-lg text-left text-xs color-text-secondary mb-6 space-y-2">
            <p>
              <i className="fa-solid fa-lock mr-2 text-primary" aria-hidden="true" />
              <strong>Sigilo Garantido:</strong> Nenhuma liderança ou colega terá acesso a respostas individuais.
            </p>
            <p>
              <i className="fa-solid fa-clock mr-2 text-primary" aria-hidden="true" />
              <strong>Rápido:</strong> São apenas {questions.length} perguntas, levando cerca de 3 a 5 minutos.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg w-full"
            onClick={() => setCurrentStep(0)}
          >
            <span>Iniciar Resposta</span>
            <i className="fa-solid fa-arrow-right ml-2" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Tela de Revisão / Conclusão
  if (currentStep >= questions.length) {
    const answeredCount = Object.keys(answers).length;
    const allAnswered = answeredCount === questions.length;

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-subtle p-4">
        <div className="card p-8 max-w-lg bg-surface shadow-sm text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <i className="fa-solid fa-paper-plane text-xl" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-primary mb-2">Pronto para Enviar?</h1>
          <p className="text-sm color-text-secondary mb-6">
            Você respondeu {answeredCount} de {questions.length} questões.
          </p>

          {!allAnswered && (
            <div className="alert alert-warning mb-6 text-xs text-left">
              <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true" />
              Para que seus dados sejam processados estatisticamente, todas as perguntas devem ser respondidas.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-secondary flex-1"
              onClick={() => setCurrentStep(questions.length - 1)}
              disabled={isSubmitting}
            >
              <i className="fa-solid fa-arrow-left mr-1" aria-hidden="true" /> Voltar
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || !allAnswered}
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" />
                  Enviando...
                </>
              ) : (
                <>
                  Confirmar Envio
                  <i className="fa-solid fa-check ml-2" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Pergunta Atual
  const currentQuestion = questions[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / questions.length) * 100);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface-subtle p-4 max-w-2xl mx-auto">
      {/* Topo: Progresso e Título */}
      <div className="py-4">
        <div className="flex items-center justify-between text-xs color-text-muted mb-2">
          <span>{surveyTitle}</span>
          <span className="font-semibold">
            {currentStep + 1} de {questions.length} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-border rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Conteúdo Central da Pergunta */}
      <div ref={cardRef} className="card p-8 bg-surface shadow-sm my-auto text-left">
        {currentQuestion.label && (
          <span className="badge badge-primary text-xs font-semibold mb-3 inline-block">
            {currentQuestion.label}
          </span>
        )}
        <h2 className="text-lg md:text-xl font-bold text-primary mb-6 leading-relaxed">
          {mode === 'dialogue' ? displayedText : currentQuestion.text}
        </h2>

        {/* Opções de Escala de 1 a 5 */}
        <div ref={optionsRef} className="grid grid-cols-1 gap-2.5">
          {optionsList.map((optText, idx) => {
            const score = idx + 1;
            const isSelected = selectedScore === score || answers[currentQuestion.id] === score;

            return (
              <button
                key={score}
                type="button"
                data-score={score}
                className={`dialogue-pill-option p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-subtle color-text-primary'
                }`}
                onClick={() => handleSelectOption(currentQuestion.id, score)}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-primary text-white' : 'bg-surface-subtle text-muted border border-border'
                    }`}
                  >
                    {score}
                  </span>
                  <span className="text-sm font-medium">{optText}</span>
                </div>
                {isSelected && <i className="fa-solid fa-check text-primary text-sm" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rodapé: Navegação e Alternância */}
      <div className="py-4 flex items-center justify-between text-xs color-text-muted">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
        >
          <i className="fa-solid fa-chevron-left mr-1" aria-hidden="true" /> Anterior
        </button>

        <span className="text-center text-xs text-muted">
          <i className="fa-solid fa-lock mr-1" aria-hidden="true" />
          Resposta confidencial
        </span>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setCurrentStep((prev) => prev + 1)}
          disabled={!answers[currentQuestion.id]}
        >
          Próxima <i className="fa-solid fa-chevron-right ml-1" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

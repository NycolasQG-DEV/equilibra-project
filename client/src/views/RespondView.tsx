import React, { useEffect, useRef, useState } from 'react';

interface Question {
  id: string;
  label?: string;
  text: string;
  options: string[];
}

interface RespondViewProps {
  token: string;
  surveyTitle: string;
  questions: Question[];
  onSubmit: (answers: Record<string, number>) => Promise<void>;
}

export const RespondView: React.FC<RespondViewProps> = ({
  surveyTitle,
  questions,
  onSubmit,
}) => {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = boas-vindas
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mode, setMode] = useState<'dialogue' | 'standard'>('dialogue');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [displayedText, setDisplayedText] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const anime = (window as any).anime;

  // Typewriter effect suave e orgânico
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

        let delay = 35;
        if (char === ',' || char === ';') delay += 90;
        else if (char === '.' || char === '!' || char === '?') delay += 180;
        else if (char === ' ') delay += 12;

        timer = setTimeout(typeChar, delay);
      }
    }

    timer = setTimeout(typeChar, 100);
    return () => clearTimeout(timer);
  }, [currentStep, mode, questions]);

  // Animação de entrada dos cards e opções com Anime.js
  useEffect(() => {
    if (!anime || mode !== 'dialogue') return;

    if (cardRef.current) {
      anime({
        targets: cardRef.current,
        opacity: [0, 1],
        translateY: [28, 0],
        duration: 520,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      });
    }

    if (optionsRef.current) {
      const pills = optionsRef.current.querySelectorAll('.dialogue-pill-option');
      if (pills.length > 0) {
        anime({
          targets: pills,
          opacity: [0, 1],
          translateY: [18, 0],
          duration: 480,
          delay: anime.stagger(55, { start: 200 }),
          easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        });
      }
    }
  }, [currentStep, mode]);

  const handleSelectOption = (questionId: string, score: number) => {
    setSelectedScore(score);
    const updated = { ...answers, [questionId]: score };
    setAnswers(updated);

    // Punch scale animado na opção escolhida
    if (anime && optionsRef.current) {
      const activeBtn = optionsRef.current.querySelector(`[data-score="${score}"]`);
      if (activeBtn) {
        anime({
          targets: activeBtn,
          scale: [1, 0.94, 1.03, 1],
          duration: 380,
          easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        });
      }
    }

    setTimeout(() => {
      setSelectedScore(null);
      setCurrentStep((prev) => prev + 1);
    }, 380);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(answers);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="center-page-wrap">
        <div className="card p-8 text-center max-w-md bg-surface">
          <div className="status-icon-circle status-icon-circle-lg status-icon-circle-success mb-4 mx-auto">
            <i className="fa-solid fa-check" aria-hidden="true" />
          </div>
          <h1 className="view-title mb-2">Resposta Enviada com Sucesso</h1>
          <p className="view-subtitle mb-4">
            Agradecemos sua colaboração confidencial. Suas percepções contribuem diretamente para melhorias no clima e nas condições de trabalho.
          </p>
          <span className="badge badge-neutral">Participação Concluída</span>
        </div>
      </div>
    );
  }

  // Tela Inicial de Boas-Vindas
  if (currentStep === -1) {
    return (
      <div className="dialogue-viewport">
        <header className="dialogue-top-bar">
          <div className="dialogue-brand">
            <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Equilibra Escuta
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setMode('standard');
              setCurrentStep(0);
            }}
          >
            Modo Formulário Completo
          </button>
        </header>

        <main className="dialogue-main">
          <div className="dialogue-welcome-card text-center" ref={cardRef}>
            <div className="dialogue-welcome-icon">
              <i className="fa-solid fa-comments" aria-hidden="true" />
            </div>
            <h1 className="dialogue-welcome-title">{surveyTitle}</h1>
            <p className="dialogue-welcome-text">
              Olá! Sou a <strong>Maya</strong>, facilitadora da Equilibra. Conduzirei esta conversa
              individual e anônima sobre sua experiência profissional.
            </p>

            <div className="dialogue-welcome-buttons flex flex-col gap-3">
              <button
                type="button"
                className="btn btn-primary btn-lg w-full"
                onClick={() => {
                  setIsVoiceActive(true);
                  setCurrentStep(0);
                }}
              >
                <i className="fa-solid fa-volume-high" aria-hidden="true" /> Iniciar Diálogo com Narração
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-lg w-full"
                onClick={() => {
                  setIsVoiceActive(false);
                  setCurrentStep(0);
                }}
              >
                <i className="fa-solid fa-volume-xmark" aria-hidden="true" /> Iniciar em Modo Leitura
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Finalização do Diálogo (Envio)
  if (currentStep >= questions.length) {
    return (
      <div className="dialogue-viewport">
        <header className="dialogue-top-bar">
          <div className="dialogue-brand">
            <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Equilibra
          </div>
          <span className="badge badge-success">Todas as questões respondidas</span>
        </header>

        <div className="dialogue-progress-line-wrap">
          <div className="dialogue-progress-line-fill" style={{ width: '100%' }} />
        </div>

        <main className="dialogue-main">
          <div className="dialogue-card" ref={cardRef}>
            <div className="dialogue-speaker-badge">
              <i className="fa-solid fa-sparkles" aria-hidden="true" /> Maya • Conclusão
            </div>

            <div className="dialogue-typewriter-container my-4 text-lg">
              Muito obrigada pela sua dedicação! Suas respostas apoiarão planos de ação concretos e transparentes.
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg w-full"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Enviando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-shield-halved" aria-hidden="true" /> Enviar Minhas Respostas
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const currentQ = questions[currentStep];
  const progressPercent = Math.round((currentStep / questions.length) * 100);

  return (
    <div className="dialogue-viewport">
      <header className="dialogue-top-bar">
        <div className="dialogue-brand">
          <i className="fa-solid fa-scale-balanced" aria-hidden="true" /> Equilibra
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm ${isVoiceActive ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsVoiceActive(!isVoiceActive)}
          >
            <i className={`fa-solid ${isVoiceActive ? 'fa-volume-high' : 'fa-volume-xmark'}`} aria-hidden="true" />
            <span>{isVoiceActive ? 'Voz Ativa' : 'Mudo'}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setMode(mode === 'dialogue' ? 'standard' : 'dialogue')}
          >
            {mode === 'dialogue' ? 'Formulário' : 'Diálogo'}
          </button>
        </div>
      </header>

      <div className="dialogue-progress-line-wrap">
        <div className="dialogue-progress-line-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <main className="dialogue-main">
        <div className="dialogue-card" ref={cardRef}>
          <div className="dialogue-speaker-badge">
            <i className="fa-solid fa-circle-dot" aria-hidden="true" /> Questão {currentStep + 1} de {questions.length}
          </div>

          <div className="dialogue-typewriter-container my-4">
            <span className="text-lg font-medium">{displayedText}</span>
          </div>

          <div className="dialogue-options-wrap" ref={optionsRef}>
            {currentQ.options.map((opt, idx) => {
              const score = idx + 1;
              const isSelected = selectedScore === score;

              return (
                <button
                  key={score}
                  type="button"
                  data-score={score}
                  className={`dialogue-pill-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(currentQ.id, score)}
                >
                  <span className="dialogue-pill-score">{score}</span>
                  <span className="dialogue-pill-text">{opt}</span>
                  <i className="fa-solid fa-check color-primary" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

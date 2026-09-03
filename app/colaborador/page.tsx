"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";

interface SurveyLinkData {
  id: string;
  title: string;
  sector: string;
  role?: string | null;
  adminName?: string;
  createdAt?: string;
  active: boolean;
  used: boolean;
}

interface StepData {
  bot_statement: string;
  next_question: string;
  ui_widget: "binary_cards" | "text_input" | "slider_0_10" | "stars_rating" | "choice_chips" | "emoji_scale";
  widget_options?: {
    placeholder?: string;
    min_label?: string;
    max_label?: string;
    choices?: string[];
    card_left?: { label: string; icon: string };
    card_right?: { label: string; icon: string };
  };
  dimension_target?: string;
  is_interview_complete?: boolean;
}

export default function ColaboradorPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0d0a17] text-purple-200">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-900 border-t-purple-400" />
        </div>
      }
    >
      <ColaboradorContent />
    </Suspense>
  );
}

function ColaboradorContent() {
  const searchParams = useSearchParams();
  const linkParam = searchParams.get("link") || searchParams.get("linkId") || searchParams.get("campaign");

  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkData, setLinkData] = useState<SurveyLinkData | null>(null);

  // App View State: "invalid_link" | "onboarding" | "interview" | "completed"
  const [view, setView] = useState<"invalid_link" | "onboarding" | "interview" | "completed">("onboarding");

  // Onboarding Wizard Form
  const [workerName, setWorkerName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [workerRole, setWorkerRole] = useState("Operacional");
  const [sector, setSector] = useState("Produção Geral");
  const [shift, setShift] = useState("1º Turno (Manhã)");
  const [companyTime, setCompanyTime] = useState("6 meses a 2 anos");
  const [lgpdConsent, setLgpdConsent] = useState(true);

  // Interview state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepData | null>(null);
  const [stepNumber, setStepNumber] = useState(1);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Sequential Dialog State
  const [activeDisplayText, setActiveDisplayText] = useState("");
  const [isTypingActive, setIsTypingActive] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isQuestionPhase, setIsQuestionPhase] = useState(false);
  const [showWidgets, setShowWidgets] = useState(false);
  const [isWidgetExiting, setIsWidgetExiting] = useState(false);
  const currentTokenRef = useRef(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Widget input states
  const [textAnswer, setTextAnswer] = useState("");
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const [selectedChip, setSelectedChip] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  // LGPD Rights Dialog
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [dpoInfo, setDpoInfo] = useState<any>(null);

  const recognitionRef = useRef<any>(null);

  // ─── 1. Verificar Validade do Link ───
  useEffect(() => {
    async function verify() {
      if (!linkParam) {
        setLinkError(
          "Nenhum link de pesquisa foi informado na URL. O acesso a esta avaliação exige um link exclusivo e ativo gerado pelo Administrador / SESMT da sua empresa."
        );
        setView("invalid_link");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/survey-links/verify/${encodeURIComponent(linkParam)}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setLinkError(
            data.error || "Link de pesquisa inválido, expirado ou pausado pelo gestor da empresa."
          );
          setView("invalid_link");
        } else {
          setLinkData(data.link);
          if (data.link.sector && data.link.sector !== "all") {
            setSector(data.link.sector);
          }
          if (data.link.role) {
            setWorkerRole(data.link.role);
          }
          setView("onboarding");
        }
      } catch (err) {
        setLinkError("Erro de comunicação com o servidor ao validar o link de pesquisa.");
        setView("invalid_link");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [linkParam]);

  // ─── 2. Inicialização do Reconhecimento de Voz (STT) ───
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "pt-BR";

        rec.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setTextAnswer(currentTranscript);
          }
        };

        rec.onerror = () => setIsRecording(false);
        rec.onend = () => setIsRecording(false);

        recognitionRef.current = rec;
        setSpeechSupported(true);
      }
    }
  }, []);

  // ─── Helper Functions: Audio & Text Cleaning ───
  function cleanTextForSpeech(text: string): string {
    if (!text) return "";
    return text
      .replace(/\bEquilibraAI\b/gi, "Equilibra A I")
      .replace(/\bNR-?0?1\b/gi, "Norma Regulamentadora 1")
      .replace(/\bNR-?17\b/gi, "Norma Regulamentadora 17")
      .replace(/\bISTAS-?21-?BR\b/gi, "Ístas 21 Brasil")
      .replace(/\bISTAS-?21\b/gi, "Ístas 21")
      .replace(/\bSST\b/gi, "Saúde e Segurança do Trabalho")
      .replace(/\bRH\b/gi, "Recursos Humanos")
      .replace(/\bSESMT\b/gi, "Sésmit")
      .replace(/\bLGPD\b/gi, "L G P D")
      .replace(/\bEPIs?\b/gi, "E P I")
      .replace(/\bPGR\b/gi, "P G R")
      .replace(/\bGRO\b/gi, "G R O")
      .replace(/\bCIPA\b/gi, "Cípa")
      .replace(/\[.*?\]/g, "")
      .replace(/[*_#`~]/g, "")
      .trim();
  }

  function getBestPtVoice(): SpeechSynthesisVoice | null {
    if (typeof window !== "undefined" || !("speechSynthesis" in window)) {
      const voices = window.speechSynthesis.getVoices() || [];
      if (voices.length === 0) return null;

      const ptBrVoices = voices.filter(
        (v) => v.lang && (v.lang === "pt-BR" || v.lang === "pt_BR" || v.lang.toLowerCase().replace("_", "-").includes("pt-br"))
      );

      const femaleKeywords = [
        "francisca", "thalita", "maria", "leticia", "luciana", "yeda", "fernanda",
        "google português do brasil", "female", "mulher", "natural", "neural"
      ];

      for (const kw of femaleKeywords) {
        const found = ptBrVoices.find((v) => v.name.toLowerCase().includes(kw));
        if (found) return found;
      }

      if (ptBrVoices.length > 0) return ptBrVoices[0];
      const anyPt = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
      return anyPt || null;
    }
    return null;
  }

  function splitIntoSentences(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/[^.!?]+(?:[.!?]+(?:\s|$)|$)/g);
    if (!matches || matches.length === 0) return [text.trim()];
    return matches.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Efeitos Sonoros com Web Audio API (Sons Elegantes e Nativos) ───
  function playAudioChime(type: "pop" | "select" | "success" | "appear") {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "pop") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "select") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === "appear") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.08);
        osc.frequency.setValueAtTime(659.25, now + 0.16);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch {
      // Audio context fallback
    }
  }

  // ─── Sincronia Fluida: Microsoft Edge Neural Voice AI (Voz Feminina Natural e Clara) com Fallback Nativo ───
  async function speakAndTypeSentence(text: string, token: number, isTts: boolean): Promise<boolean> {
    if (token !== currentTokenRef.current) return false;
    
    setIsFadingOut(false);
    setActiveDisplayText("");
    setIsTypingActive(false);
    // 🛑 Mantém a animação de carregamento (3 pontinhos) ativa enquanto o áudio neural é sintetizado
    setIsAiTyping(true);

    let speechPromise: Promise<boolean> | null = null;
    let keepAliveInterval: any = null;

    let audioReadyResolve: () => void;
    const audioReadyPromise = new Promise<void>((resolve) => {
      audioReadyResolve = resolve;
    });

    let isSpeechFinished = false;

    // 1. SÍNTESE DE VOZ NEURAL BRASILEIRA PADRONIZADA (Zero Custo & Natural em Todos os Navegadores)
    if (isTts && typeof window !== "undefined") {
      const naturalText = cleanTextForSpeech(text);
      if (naturalText) {
        let audioStreamSuccess = false;

        try {
          if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current = null;
          }
          if ("speechSynthesis" in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            window.speechSynthesis.cancel();
          }

          // 1. Requisição à rota universal de TTS (/api/tts)
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: naturalText }),
          });

          if (res.ok) {
            const blob = await res.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            activeAudioRef.current = audio;

            speechPromise = new Promise((resolve) => {
              let started = false;

              const handleStart = () => {
                if (!started) {
                  started = true;
                  if (token === currentTokenRef.current) {
                    setIsAiTyping(false);
                    setIsSpeaking(true);
                    setIsTypingActive(true);
                  }
                  audioReadyResolve();
                }
              };

              audio.onplay = handleStart;
              audio.oncanplaythrough = handleStart;
              audio.onended = () => {
                if (!isSpeechFinished) {
                  isSpeechFinished = true;
                  setIsSpeaking(false);
                  URL.revokeObjectURL(audioUrl);
                  resolve(true);
                }
              };
              audio.onerror = () => {
                handleStart();
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
                resolve(true);
              };

              setTimeout(() => {
                handleStart();
              }, 300);

              audio.play().catch(() => {
                handleStart();
              });
            });

            audioStreamSuccess = true;
            await audioReadyPromise;
          }
        } catch (audioErr) {
          console.warn("⚠️ Gateway TTS em fallback local:", audioErr);
        }

        // TENTATIVA 2: FALLBACK NATIVO (Web Speech Synthesis)
        if (!audioStreamSuccess && "speechSynthesis" in window) {
          speechPromise = new Promise((resolve) => {
            let started = false;
            const utterance = new SpeechSynthesisUtterance(naturalText);
            const voice = getBestPtVoice();
            if (voice) utterance.voice = voice;
            utterance.lang = "pt-BR";
            utterance.rate = 1.0;
            utterance.pitch = 1.02;
            utterance.volume = 1.0;

            const handleStart = () => {
              if (!started) {
                started = true;
                if (token === currentTokenRef.current) {
                  setIsAiTyping(false);
                  setIsSpeaking(true);
                  setIsTypingActive(true);
                }
                audioReadyResolve();
              }
            };

            const handleEnd = () => {
              if (!isSpeechFinished) {
                isSpeechFinished = true;
                if (keepAliveInterval) clearInterval(keepAliveInterval);
                setIsSpeaking(false);
                resolve(true);
              }
            };

            utterance.onstart = handleStart;
            utterance.onend = handleEnd;
            utterance.onerror = () => {
              handleStart();
              handleEnd();
            };

            setTimeout(() => {
              handleStart();
            }, 260);

            keepAliveInterval = setInterval(() => {
              if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
              }
            }, 3500);

            try {
              window.speechSynthesis.speak(utterance);
              if (window.speechSynthesis.paused) window.speechSynthesis.resume();
            } catch {
              handleStart();
              handleEnd();
            }
          });

          await audioReadyPromise;
        }
      } else {
        setIsAiTyping(false);
        setIsSpeaking(true);
        setIsTypingActive(true);
      }
    } else {
      setIsAiTyping(false);
      setIsSpeaking(true);
      setIsTypingActive(true);
    }

    if (token !== currentTokenRef.current) {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      return false;
    }

    // 2. DIGITAÇÃO FLUIDA (-20% de velocidade: 52ms base)
    const baseSpeed = 52;
    let currentStr = "";

    for (let i = 0; i < text.length; i++) {
      if (token !== currentTokenRef.current) {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        setIsTypingActive(false);
        return false;
      }

      currentStr += text[i];
      setActiveDisplayText(currentStr);

      const char = text[i];
      const nextChar = text[i + 1] || "";
      const prevChar = text[i - 1] || "";

      let delay = baseSpeed + (Math.floor(Math.random() * 8) - 4);
      if (delay < 28) delay = 28;

      if ([".", "!", "?"].includes(char)) {
        delay = nextChar !== "." && nextChar !== "!" && nextChar !== "?" ? 280 : 120;
      } else if ([",", ";", ":", "—", "-"].includes(char)) {
        delay = 170;
      } else if (char === " " && [",", ".", "!", "?", ";"].includes(prevChar)) {
        delay = baseSpeed + 20;
      }

      await sleep(delay);
    }

    // Se o áudio ainda estiver reproduzindo a pronúncia final, aguarda a voz
    if (speechPromise) {
      await Promise.race([speechPromise, sleep(8000)]);
    }

    if (keepAliveInterval) clearInterval(keepAliveInterval);
    setIsSpeaking(false);
    setIsTypingActive(false);
    return token === currentTokenRef.current;
  }

  // ─── Transição de Apagamento Quase Instantâneo (120ms) ───
  async function fadeOutCurrentText(token: number, durationMs: number = 120): Promise<boolean> {
    if (token !== currentTokenRef.current) return false;
    setIsFadingOut(true);
    await sleep(durationMs);
    if (token !== currentTokenRef.current) return false;
    setActiveDisplayText("");
    setIsFadingOut(false);
    return true;
  }

  // ─── 3. Orquestrador de Diálogo com 2s de Espera e Apagamento Quase Instantâneo ───
  useEffect(() => {
    if (!currentStep) return;

    const myToken = ++currentTokenRef.current;
    setShowWidgets(false);
    setIsQuestionPhase(false);
    setActiveDisplayText("");
    setIsFadingOut(false);

    async function runStepSequence() {
      if (!currentStep) return;

      const statement = (currentStep.bot_statement || "").trim();
      const hasStatement = statement.length > 0 && statement.toLowerCase() !== "null" && statement.toLowerCase() !== "undefined";

      // 1. Apresentação do diálogo / comentário (se houver e for relevante)
      if (hasStatement) {
        const sentences = splitIntoSentences(statement);

        for (let i = 0; i < sentences.length; i++) {
          if (myToken !== currentTokenRef.current) return;
          const sentence = sentences[i];

          // Fala e digita em sincronia
          const finished = await speakAndTypeSentence(sentence, myToken, isTtsEnabled);
          if (!finished || myToken !== currentTokenRef.current) return;

          // 🛑 TEMPO DE TRANSIÇÃO ÁGIL: Entre 400ms e 600ms (média 500ms) após o áudio terminar
          await sleep(500);
          if (myToken !== currentTokenRef.current) return;

          // Apagamento rápido e fluido antes de ir para a próxima frase
          await fadeOutCurrentText(myToken, 80);
          if (myToken !== currentTokenRef.current) return;
        }
      }

      if (myToken !== currentTokenRef.current) return;

      // 2. Apresentação da pergunta principal (direta e fluida)
      setIsQuestionPhase(true);
      const questionText = currentStep.next_question || "Como você avalia este ponto?";
      const finishedQuestion = await speakAndTypeSentence(questionText, myToken, isTtsEnabled);
      if (!finishedQuestion || myToken !== currentTokenRef.current) return;

      // 3. Libera os widgets interativos com transição rápida
      playAudioChime("appear");
      setShowWidgets(true);
    }

    runStepSequence();

    return () => {
      currentTokenRef.current++;
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    };
  }, [currentStep, isTtsEnabled]);

  // ─── 4. Iniciar Sessão ───
  const handleStartSession = async () => {
    if (!lgpdConsent) {
      alert("É necessário aceitar os termos de consentimento e sigilo para iniciar a avaliação.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerName: "Colaborador Anônimo",
          workerRole,
          sector,
          shift,
          companyTime,
          consentGiven: lgpdConsent,
          linkId: linkParam,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Não foi possível iniciar a sessão.");
        return;
      }

      setSessionId(data.sessionId);
      setCurrentStep(data.session.currentStepData);
      setStepNumber(1);
      setView("interview");
    } catch (err) {
      alert("Erro ao conectar com o servidor da IA.");
    } finally {
      setLoading(false);
    }
  };

  // ─── 5. Enviar Resposta e Avançar com IA com Animação de Saída ───
  const handleSubmitAnswer = async (answerValue: string, widgetUsed: string) => {
    if (!answerValue || !sessionId) return;

    // 🛑 Animação de Saída Fluida dos Elementos do Quiz
    setIsWidgetExiting(true);
    await sleep(200);
    setShowWidgets(false);
    setIsWidgetExiting(false);

    setIsAiTyping(true);
    setTextAnswer("");
    setSelectedChip("");
    setSliderValue(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAnswer: answerValue,
          widgetType: widgetUsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao registrar resposta.");
        setIsAiTyping(false);
        return;
      }

      if (data.isCompleted) {
        await handleFinishSession(sessionId);
      } else {
        setCurrentStep(data.nextStep);
        setStepNumber((prev) => prev + 1);
      }
    } catch (err) {
      alert("Erro ao enviar resposta à IA.");
    } finally {
      setIsAiTyping(false);
    }
  };

  // ─── 6. Finalizar Sessão ───
  const handleFinishSession = async (currentSessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${currentSessionId}/finish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Erro ao gerar relatório:", data.error);
      }
      setView("completed");
    } catch (err) {
      console.error("Erro ao concluir sessão:", err);
      setView("completed");
    }
  };

  // ─── 7. Toggle Gravação de Voz ───
  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  // ─── Render: Loading ───
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0a17] text-white font-['Montserrat',sans-serif]">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-purple-900 border-t-purple-400" />
        <p className="mt-5 text-lg font-semibold text-purple-200">Validando link de pesquisa...</p>
      </div>
    );
  }

  // ─── Render: Link Inválido ou Ausente ───
  if (view === "invalid_link") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0d0a17] via-[#160e29] to-[#0d0a17] p-6 flex flex-col items-center justify-center font-['Montserrat',sans-serif] text-white">
        <div className="w-full max-w-xl rounded-3xl border border-purple-500/20 bg-[#160e29]/90 p-10 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/15 text-red-400 text-3xl">
            <i className="fa-solid fa-link-slash"></i>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">
            Link de Pesquisa Necessário
          </h1>
          <p className="text-base text-purple-200/80 mb-8 leading-relaxed">
            {linkError || "Para responder à avaliação do seu setor, utilize o link exclusivo fornecido pelo RH ou gestor da sua equipe."}
          </p>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-950/40 p-5 text-left text-sm leading-relaxed text-purple-200/90">
            <strong className="text-white flex items-center gap-2 mb-1.5 text-base">
              <i className="fa-solid fa-circle-info text-purple-400"></i> Como participar:
            </strong>
            Solicite o link de acesso ao supervisor ou responsável de segurança da sua área.
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Onboarding (Design Limpo, Humano, Elegante e Sem Poluição Visual) ───
  if (view === "onboarding") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0d0a17] via-[#140e26] to-[#0d0a17] py-6 px-4 text-white flex flex-col items-center justify-center font-['Montserrat',sans-serif]">
        <div className="w-full max-w-xl">
          
          {/* Header Superior: Apenas controle de áudio discreto à direita */}
          <header className="flex items-center justify-end mb-4 px-1">
            <button
              type="button"
              onClick={() => setIsTtsEnabled(!isTtsEnabled)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                isTtsEnabled
                  ? "border-purple-400/40 bg-purple-600/25 text-purple-300 shadow-sm shadow-purple-950/40"
                  : "border-purple-500/20 bg-purple-950/40 text-purple-400/50 hover:text-white"
              }`}
              title="Áudio da pesquisa ativado/desativado"
            >
              <i className={`fa-solid ${isTtsEnabled ? "fa-volume-high" : "fa-volume-xmark"} text-xs`}></i>
            </button>
          </header>

          {/* Card Principal: Clean, Direto, Sóbrio e Profissional */}
          <main className="relative rounded-xl border border-purple-500/20 bg-[#160e29]/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
            
            {/* Título & Propósito */}
            <div className="mb-5">
              <h1 className="text-xl font-bold text-white mb-1.5 tracking-tight">
                Avaliação de Rotina e Bem-Estar
              </h1>
              <p className="text-xs sm:text-sm text-purple-200/70 leading-relaxed">
                Suas respostas são 100% confidenciais e ajudam a construir um ambiente de trabalho mais seguro e equilibrado.
              </p>
            </div>

            {/* Dados do Setor & Cargo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-purple-500/15 bg-purple-950/30 p-3">
                <span className="text-[11px] font-medium text-purple-300/60 block mb-0.5">Setor</span>
                <span className="text-sm font-semibold text-white truncate block">
                  {sector === "all" ? "Geral da Empresa" : sector}
                </span>
              </div>

              <div className="rounded-lg border border-purple-500/15 bg-purple-950/30 p-3">
                <span className="text-[11px] font-medium text-purple-300/60 block mb-0.5">Cargo</span>
                <span className="text-sm font-semibold text-white truncate block">
                  {workerRole || "Operacional"}
                </span>
              </div>
            </div>

            {/* Turno e Tempo de Empresa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-purple-200/80 mb-1.5">
                  Seu Turno
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full rounded-lg border border-purple-500/20 bg-[#120b22] px-3.5 py-2.5 text-sm text-white focus:border-purple-400 focus:outline-none transition-colors"
                >
                  <option value="1º Turno (Manhã)">1º Turno (Manhã)</option>
                  <option value="2º Turno (Tarde)">2º Turno (Tarde)</option>
                  <option value="3º Turno (Noturno)">3º Turno (Noturno)</option>
                  <option value="Comercial / Geral">Comercial / Geral</option>
                  <option value="Escala 12x36">Escala 12x36</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-purple-200/80 mb-1.5">
                  Tempo na Empresa
                </label>
                <select
                  value={companyTime}
                  onChange={(e) => setCompanyTime(e.target.value)}
                  className="w-full rounded-lg border border-purple-500/20 bg-[#120b22] px-3.5 py-2.5 text-sm text-white focus:border-purple-400 focus:outline-none transition-colors"
                >
                  <option value="Menos de 6 meses">Menos de 6 meses</option>
                  <option value="6 meses a 2 anos">6 meses a 2 anos</option>
                  <option value="2 a 5 anos">2 a 5 anos</option>
                  <option value="Mais de 5 anos">Mais de 5 anos</option>
                </select>
              </div>
            </div>

            {/* Consentimento & Termos */}
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-purple-500/15 bg-purple-950/25 p-3">
              <input
                type="checkbox"
                id="privacy-consent-check"
                checked={lgpdConsent}
                onChange={(e) => {
                  if (e.target.checked && !termsRead) {
                    setShowLgpdModal(true);
                  } else {
                    setLgpdConsent(e.target.checked);
                  }
                }}
                className="mt-0.5 h-4 w-4 rounded border-purple-400 bg-purple-950 text-purple-600 focus:ring-0 cursor-pointer accent-purple-600"
              />
              <label htmlFor="privacy-consent-check" className="text-xs text-purple-200/80 cursor-pointer leading-relaxed">
                Concordo com a participação anônima e os{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLgpdModal(true);
                  }}
                  className="font-medium text-purple-300 underline underline-offset-2 hover:text-white transition-colors"
                >
                  termos de privacidade
                </button>
                .
              </label>
            </div>

            {/* Botão de Início Sólido e Elegante (Sem Gradiente) */}
            <button
              type="button"
              onClick={() => {
                if (!lgpdConsent) {
                  setShowLgpdModal(true);
                  return;
                }
                handleStartSession();
              }}
              disabled={loading || !lgpdConsent}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-500 active:bg-purple-700 py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-purple-950/50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <span>Iniciar Avaliação</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </button>
          </main>
        </div>

        {/* Modal de Termos de Privacidade no Onboarding */}
        {showLgpdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md font-['Montserrat',sans-serif]">
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#160e29] p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-3.5">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-shield-halved text-purple-400"></i>
                  <h3 className="font-bold text-white text-base">Termos de Privacidade e Proteção de Dados</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLgpdModal(false)}
                  className="text-purple-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs sm:text-sm leading-relaxed text-purple-200/90">
                <div className="rounded-xl bg-purple-950/40 p-3.5 border border-purple-500/20">
                  <p className="font-semibold text-white mb-1">1. Fundamentação Legal e Finalidade</p>
                  <p>
                    Esta avaliação é realizada estritamente para fins de gestão de riscos ocupacionais e ergonomia psicossocial, atendendo às diretrizes da <strong>Norma Regulamentadora nº 1 (NR-01 - GRO/PGR)</strong> do Ministério do Trabalho e Emprego.
                  </p>
                </div>

                <div className="rounded-xl bg-purple-950/40 p-3.5 border border-purple-500/20">
                  <p className="font-semibold text-white mb-1">2. Conformidade com a LGPD (Lei nº 13.709/2018)</p>
                  <p>
                    O tratamento dos dados apoia-se no <strong>Art. 7º, inciso II</strong> (cumprimento de obrigação legal e regulatória) e no <strong>Art. 11, inciso II, alínea "f"</strong> (tutela da saúde ocupacional).
                  </p>
                </div>

                <div className="rounded-xl bg-purple-950/40 p-3.5 border border-purple-500/20">
                  <p className="font-semibold text-white mb-1">3. Sigilo e Anonimato Absoluto</p>
                  <p>
                    Suas respostas são processadas de forma agregada e pseudonimizada pelo motor de inteligência artificial. A diretoria ou chefia imediata <strong>não possui acesso a respostas nominais individuais</strong>.
                  </p>
                </div>

                <div className="text-[11px] text-purple-300/70 pt-0.5">
                  <strong>Encarregado de Dados (DPO):</strong>{" "}
                  {dpoInfo?.name || "Comitê de Privacidade • Equilibra SST"} (
                  <span className="font-mono text-purple-300">{dpoInfo?.email || "dpo.privacidade@equilibra-sst.corp.br"}</span>)
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTermsRead(true);
                    setLgpdConsent(true);
                    setShowLgpdModal(false);
                  }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:from-purple-500 hover:to-indigo-500"
                >
                  Li e Concordo com os Termos
                </button>
                <button
                  type="button"
                  onClick={() => setShowLgpdModal(false)}
                  className="rounded-xl border border-purple-500/30 px-4 py-3 text-xs sm:text-sm font-semibold text-purple-300 hover:bg-purple-950"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Interview (Tema Roxo, Tamanho Ampliado & Sem Poluição Visual) ───
  if (view === "interview") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0d0a17] via-[#140e26] to-[#0d0a17] py-10 px-4 sm:px-6 text-white flex flex-col items-center justify-center font-['Montserrat',sans-serif]">
        <div className="w-full max-w-4xl">
          
          {/* Top Header: Controle de áudio discreto à direita */}
          <header className="flex items-center justify-end mb-6 px-1">
            <button
              type="button"
              onClick={() => {
                if (activeAudioRef.current) {
                  activeAudioRef.current.pause();
                  activeAudioRef.current = null;
                }
                if (isSpeaking && typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }
                setIsTtsEnabled(!isTtsEnabled);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                isTtsEnabled
                  ? "border-purple-400/40 bg-purple-600/25 text-purple-300 shadow-sm shadow-purple-950/40"
                  : "border-purple-500/20 bg-purple-950/40 text-purple-400/50 hover:text-white"
              }`}
              title={isTtsEnabled ? "Desativar áudio da assistente" : "Ativar áudio da assistente"}
            >
              <i className={`fa-solid ${isTtsEnabled ? "fa-volume-high" : "fa-volume-xmark"} text-sm`}></i>
            </button>
          </header>

          {/* Cartão Imersivo Roxo */}
          <main className={`relative rounded-3xl border bg-[#160e29]/95 p-8 sm:p-14 backdrop-blur-2xl transition-all duration-300 ${
            isSpeaking
              ? "border-purple-400/80 shadow-[0_0_70px_15px_rgba(168,85,247,0.35),0_0_130px_30px_rgba(126,34,206,0.25)]"
              : "border-purple-500/20 shadow-2xl"
          }`}>
            
            {/* Aura Luminosa Roxa */}
            <div className={`absolute -inset-[40px] -z-10 pointer-events-none overflow-visible rounded-3xl transition-opacity duration-500 ${isSpeaking ? "opacity-95" : "opacity-35"}`}>
              <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_40%,rgba(168,85,247,0.5)_0%,rgba(126,34,206,0.3)_45%,transparent_75%)] blur-[55px] animate-aura-primary" />
              <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_60%,rgba(147,51,234,0.4)_0%,rgba(88,28,135,0.2)_50%,transparent_80%)] blur-[90px] animate-aura-secondary" />
              <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_50%_50%,rgba(168,85,247,0.25)_0%,rgba(126,34,206,0.12)_55%,transparent_85%)] blur-[120px]" />
            </div>

            {/* Diálogo da IA / Pergunta com Efeito Suave de Digitação, Fade Out e 3 Pontinhos Bonitinhos */}
            <div className="mb-8 min-h-[95px] flex items-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-relaxed text-white tracking-tight w-full">
                {activeDisplayText ? (
                  <div className={isFadingOut ? "animate-text-fade-out" : ""}>
                    <span>
                      {activeDisplayText.split("").map((ch, idx) => (
                        <span key={idx} className={ch === " " ? undefined : "char-pop"}>
                          {ch}
                        </span>
                      ))}
                    </span>
                    {isTypingActive && (
                      <span className="inline-block w-[3.5px] h-[1.15em] bg-purple-400 ml-2 align-[-0.1em] rounded-sm animate-pulse shadow-[0_0_10px_#c084fc]" />
                    )}
                  </div>
                ) : isAiTyping ? (
                  <span className="inline-flex items-center gap-3 py-2 text-purple-300">
                    <span className="flex gap-2">
                      <span className="h-3 w-3 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-3 w-3 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-3 w-3 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-purple-400/40">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </h2>
            </div>

            {/* ─── Widgets Dinâmicos com Animação de Entrada e Saída (Motion) e Sons Nativos ─── */}
            {!isAiTyping && showWidgets && currentStep && (
              <div className={`mt-8 ${isWidgetExiting ? "motion-exit" : "motion-enter"}`}>
                
                {/* 1. BINARY_CARDS */}
                {currentStep.ui_widget === "binary_cards" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      style={{ animationDelay: "40ms" }}
                      onClick={() => {
                        playAudioChime("select");
                        handleSubmitAnswer(currentStep.widget_options?.card_left?.label || "Sim", "binary_cards");
                      }}
                      className="cascade-item-pop group flex flex-col items-center justify-center rounded-xl border border-purple-500/20 bg-purple-950/30 p-7 text-center shadow-lg transition-all hover:scale-[1.01] hover:border-purple-400 hover:bg-purple-900/25 active:scale-95"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <i className={`fa-solid ${currentStep.widget_options?.card_left?.icon === "chat" ? "fa-comments" : "fa-check"} text-xl`}></i>
                      </div>
                      <span className="mt-3.5 text-lg font-bold text-white">
                        {currentStep.widget_options?.card_left?.label || "Sim"}
                      </span>
                    </button>

                    <button
                      type="button"
                      style={{ animationDelay: "100ms" }}
                      onClick={() => {
                        playAudioChime("select");
                        handleSubmitAnswer(currentStep.widget_options?.card_right?.label || "Não", "binary_cards");
                      }}
                      className="cascade-item-pop group flex flex-col items-center justify-center rounded-xl border border-purple-500/20 bg-purple-950/30 p-7 text-center shadow-lg transition-all hover:scale-[1.01] hover:border-purple-400 hover:bg-purple-900/25 active:scale-95"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-purple-600/20 text-purple-300 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <i className={`fa-solid ${currentStep.widget_options?.card_right?.icon === "arrow_forward" ? "fa-arrow-right" : "fa-xmark"} text-xl`}></i>
                      </div>
                      <span className="mt-3.5 text-lg font-bold text-white">
                        {currentStep.widget_options?.card_right?.label || "Não"}
                      </span>
                    </button>
                  </div>
                )}

                {/* 2. CHOICE_CHIPS (Opções contextualizadas com centralização proporcional do último item ímpar) */}
                {currentStep.ui_widget === "choice_chips" && (() => {
                  const choices = currentStep.widget_options?.choices || [
                    "Não tem impactado",
                    "Sinto um pouco de cansaço",
                    "Chego sem energia para a família",
                    "Impacta muito meu descanso",
                    "Outro",
                  ];
                  const isOddTotal = choices.length % 2 !== 0;

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {choices.map((choice: string, idx: number) => {
                          const isLastOdd = isOddTotal && idx === choices.length - 1;

                          return (
                            <button
                              key={idx}
                              type="button"
                              style={{ animationDelay: `${(idx + 1) * 60}ms` }}
                              onClick={() => {
                                playAudioChime("pop");
                                setSelectedChip(choice);
                              }}
                              className={`cascade-item-pop relative rounded-xl border p-4 sm:p-5 text-center text-sm sm:text-base font-semibold transition-all flex items-center justify-center ${
                                isLastOdd ? "sm:col-span-2 sm:max-w-md sm:mx-auto w-full" : "w-full"
                              } ${
                                selectedChip === choice
                                  ? "border-purple-400 bg-purple-600/30 text-white shadow-lg shadow-purple-950/50"
                                  : "border-purple-500/20 bg-purple-950/30 text-purple-200 hover:bg-purple-900/25 hover:text-white"
                              }`}
                            >
                              <span className="text-center">{choice}</span>
                              {selectedChip === choice && (
                                <i className="fa-solid fa-circle-check text-purple-300 text-base absolute right-4"></i>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        style={{ animationDelay: "300ms" }}
                        onClick={() => {
                          playAudioChime("success");
                          handleSubmitAnswer(selectedChip, "choice_chips");
                        }}
                        disabled={!selectedChip}
                        className="cascade-item-pop mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 py-4 text-base font-bold text-white shadow-lg shadow-purple-950/60 transition-colors disabled:opacity-40"
                      >
                        <span>Enviar Resposta</span>
                        <i className="fa-solid fa-arrow-right text-sm"></i>
                      </button>
                    </div>
                  );
                })()}

                {/* 3. SLIDER_0_10 (Clean, Direto, Botão de Confirmar surge APÓS seleção) */}
                {currentStep.ui_widget === "slider_0_10" && (
                  <div className="space-y-5 pt-1">
                    {/* Régua de Botões 0 a 10 com Efeito em Cascata Suave */}
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                        const isSelected = sliderValue === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            style={{ animationDelay: `${num * 30}ms` }}
                            onClick={() => {
                              playAudioChime("pop");
                              setSliderValue(num);
                            }}
                            className={`cascade-item-pop flex h-13 sm:h-15 items-center justify-center rounded-xl text-lg sm:text-xl font-bold transition-all duration-150 ${
                              isSelected
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-950/60 border-2 border-purple-300 scale-105"
                                : "border border-purple-500/20 bg-purple-950/40 text-purple-200 hover:border-purple-400/50 hover:bg-purple-900/30 hover:text-white active:scale-95"
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legenda Minimalista */}
                    <div className="flex items-center justify-between text-xs font-medium text-purple-300/70 px-1">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80" />
                        0 - Insuficiente
                      </span>
                      <span className="flex items-center gap-1.5">
                        10 - Excelente
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                      </span>
                    </div>

                    {/* Botão de Confirmação: Aparece suavemente APENAS após o colaborador selecionar uma nota */}
                    {sliderValue !== null && (
                      <div className="motion-enter pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            playAudioChime("success");
                            handleSubmitAnswer(`Nota ${sliderValue}/10`, "slider_0_10");
                          }}
                          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 py-4 text-base font-bold text-white shadow-lg shadow-purple-950/60 transition-colors"
                        >
                          <span>Confirmar Nota ({sliderValue})</span>
                          <i className="fa-solid fa-arrow-right text-sm"></i>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. EMOJI_SCALE (Com efeito em cascata e sons) */}
                {currentStep.ui_widget === "emoji_scale" && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                    {[
                      { label: "Muito Ruim", score: "1/5", icon: "fa-face-frown-open", color: "text-rose-400" },
                      { label: "Desconfortável", score: "2/5", icon: "fa-face-frown", color: "text-amber-400" },
                      { label: "Neutro", score: "3/5", icon: "fa-face-meh", color: "text-yellow-400" },
                      { label: "Adequado", score: "4/5", icon: "fa-face-smile", color: "text-purple-300" },
                      { label: "Excelente", score: "5/5", icon: "fa-face-laugh-beam", color: "text-emerald-400" },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        style={{ animationDelay: `${(idx + 1) * 50}ms` }}
                        onClick={() => {
                          playAudioChime("select");
                          handleSubmitAnswer(`${item.label} (${item.score})`, "emoji_scale");
                        }}
                        className="cascade-item-pop group flex flex-col items-center justify-center rounded-xl border border-purple-500/20 bg-purple-950/30 p-5 text-center transition-all hover:scale-[1.03] hover:border-purple-400 hover:bg-purple-900/25 active:scale-95"
                      >
                        <i className={`fa-solid ${item.icon} text-3xl ${item.color} group-hover:scale-105 transition-transform mb-2.5`}></i>
                        <span className="text-xs sm:text-sm font-semibold text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 5. TEXT_INPUT (Dissertativo) */}
                {(currentStep.ui_widget === "text_input" || !currentStep.ui_widget) && (
                  <div className="cascade-item-pop space-y-4">
                    <div className="rounded-xl border border-purple-500/20 bg-[#120b22] p-5 focus-within:border-purple-400 shadow-xl">
                      <div className="flex justify-end mb-2">
                        <span className="text-xs text-purple-300/60 font-medium">{textAnswer.trim().length} caracteres</span>
                      </div>

                      <textarea
                        rows={4}
                        placeholder={currentStep.widget_options?.placeholder || "Conte com calma e detalhes sobre o seu dia a dia no setor..."}
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && textAnswer.trim()) {
                            e.preventDefault();
                            playAudioChime("success");
                            handleSubmitAnswer(textAnswer.trim(), "text_input");
                          }
                        }}
                        className="w-full resize-none bg-transparent text-base sm:text-lg text-white placeholder:text-purple-300/40 focus:outline-none leading-relaxed"
                      />

                      <div className="flex items-center justify-between border-t border-purple-500/15 pt-3.5 mt-3">
                        {speechSupported ? (
                          <button
                            type="button"
                            onClick={toggleVoiceRecording}
                            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                              isRecording
                                ? "animate-pulse border-red-500 bg-red-500/20 text-red-300"
                                : "border-purple-500/25 bg-purple-950/40 text-purple-200 hover:border-purple-400 hover:bg-purple-600/20 hover:text-white"
                            }`}
                          >
                            <i className={`fa-solid ${isRecording ? "fa-circle-dot" : "fa-microphone"}`}></i>
                            <span>{isRecording ? "Ouvindo você..." : "Falar resposta"}</span>
                          </button>
                        ) : (
                          <div />
                        )}

                        <span className="text-xs text-purple-300/50 hidden sm:inline">
                          <kbd className="bg-purple-950 px-2 py-1 rounded text-xs text-purple-200 border border-purple-500/20">Enter</kbd> para enviar
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playAudioChime("success");
                        handleSubmitAnswer(textAnswer.trim(), "text_input");
                      }}
                      disabled={!textAnswer.trim()}
                      className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 py-4 text-base font-bold text-white shadow-lg shadow-purple-950/60 transition-colors disabled:opacity-40"
                    >
                      <span>Enviar Resposta</span>
                      <i className="fa-solid fa-arrow-right text-sm"></i>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Rodapé de Confidencialidade */}
            <div className="mt-10 flex items-center justify-between border-t border-purple-500/15 pt-5 text-sm text-purple-300/60">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-purple-400"></i>
                Respostas 100% Confidenciais
              </span>
              <button
                type="button"
                onClick={() => setShowLgpdModal(true)}
                className="hover:text-purple-200 underline decoration-purple-500/50"
              >
                Termos de Privacidade
              </button>
            </div>
          </main>
        </div>

        {/* Modal de Termos na Entrevista */}
        {showLgpdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md font-['Montserrat',sans-serif]">
            <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#160e29] p-7 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-shield-halved text-purple-400"></i>
                  <h3 className="font-bold text-white text-lg">Termos de Privacidade e Proteção de Dados</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLgpdModal(false)}
                  className="text-purple-400 hover:text-white"
                >
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-relaxed text-purple-200/90">
                <div className="rounded-2xl bg-purple-950/40 p-4 border border-purple-500/20">
                  <p className="font-semibold text-white mb-1.5">1. Fundamentação Legal e Finalidade</p>
                  <p>
                    Esta avaliação é realizada estritamente para fins de gestão de riscos ocupacionais e ergonomia psicossocial, atendendo às diretrizes da <strong>Norma Regulamentadora nº 1 (NR-01 - GRO/PGR)</strong> do Ministério do Trabalho e Emprego.
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-950/40 p-4 border border-purple-500/20">
                  <p className="font-semibold text-white mb-1.5">2. Conformidade com a LGPD (Lei nº 13.709/2018)</p>
                  <p>
                    O tratamento dos dados apoia-se no <strong>Art. 7º, inciso II</strong> (cumprimento de obrigação legal e regulatória) e no <strong>Art. 11, inciso II, alínea "f"</strong> (tutela da saúde ocupacional).
                  </p>
                </div>

                <div className="rounded-2xl bg-purple-950/40 p-4 border border-purple-500/20">
                  <p className="font-semibold text-white mb-1.5">3. Sigilo e Anonimato Absoluto</p>
                  <p>
                    Suas respostas são processadas de forma agregada e pseudonimizada pelo motor de inteligência artificial. A diretoria ou chefia imediata <strong>não possui acesso a respostas nominais individuais</strong>.
                  </p>
                </div>

                <div className="text-xs text-purple-300/70 pt-1">
                  <strong>Encarregado de Dados (DPO):</strong>{" "}
                  {dpoInfo?.name || "Comitê de Privacidade • Equilibra SST"} (
                  <span className="font-mono text-purple-300">{dpoInfo?.email || "dpo.privacidade@equilibra-sst.corp.br"}</span>)
                </div>
              </div>

              <div className="mt-7 flex gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowLgpdModal(false)}
                  className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3.5 text-sm font-bold text-white hover:from-purple-500 hover:to-indigo-500"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Completed (Tema Roxo & Ampliado) ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d0a17] via-[#160e29] to-[#0d0a17] p-6 flex flex-col items-center justify-center font-['Montserrat',sans-serif] text-white">
      <div className="w-full max-w-xl rounded-3xl border border-purple-500/25 bg-[#160e29]/95 p-12 text-center shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-purple-400/40 bg-purple-600/25 text-purple-300 text-4xl shadow-xl shadow-purple-950/70">
          <i className="fa-solid fa-heart-pulse"></i>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
          Muito obrigado pela sua participação!
        </h1>
        <p className="text-base sm:text-lg text-purple-200/85 mb-8 leading-relaxed">
          Suas respostas foram salvas com sucesso de forma 100% anônima e confidencial. Elas nos ajudarão a criar um ambiente de trabalho mais seguro, saudável e acolhedor para você e sua equipe.
        </p>

        <div className="border-t border-purple-500/20 pt-6">
          <span className="text-sm text-purple-300/60 font-medium">
            Você já pode fechar esta janela com tranquilidade.
          </span>
        </div>
      </div>
    </div>
  );
}

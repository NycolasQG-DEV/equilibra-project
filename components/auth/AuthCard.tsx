"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { animate } from "animejs";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/types/database";

interface AuthCardProps {
  mode: "signup" | "login";
  onModeChange: (mode: "signup" | "login") => void;
}

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const router = useRouter();

  const [signupStep, setSignupStep] = useState(0);

  const [signupCnpj, setSignupCnpj] = useState("");
  const [signupCompanyName, setSignupCompanyName] = useState("");
  const [signupPersonName, setSignupPersonName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  const [cnpjSearching, setCnpjSearching] = useState(false);
  const [cnpjError, setCnpjError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  /* ─── Busca Automática de CNPJ (BrasilAPI) ─── */
  const fetchCnpjData = async (cnpjNumber: string) => {
    const cleanCnpj = cnpjNumber.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    setCnpjSearching(true);
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) throw new Error("CNPJ inválido ou não encontrado.");
      const data = await res.json();

      const companyName = data.nome_fantasia || data.razao_social || "";
      setSignupCompanyName(companyName);
      setSignupError(""); 
    } catch (err: any) {
      setCnpjError(err.message || "Erro ao buscar CNPJ.");
      setSignupCompanyName("");
    } finally {
      setCnpjSearching(false);
    }
  };

  /* ─── Signup ─── */
  const handleSignup = async () => {
    setSignupError(""); setSignupSuccess("");
    if (!signupCompanyName || !signupPersonName || !signupEmail || !signupCnpj || !signupPassword) { setSignupError("Preencha todos os campos."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) { setSignupError("Formato de e-mail inválido."); return; }
    if (signupPassword.length < 8) { setSignupError("A senha deve ter pelo menos 8 caracteres."); return; }
    setSignupLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail, password: signupPassword,
        options: { data: { name: signupPersonName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      await supabase.from("users").upsert([{
        id: authData.user.id,
        name: signupPersonName,
        email: signupEmail,
        cnpj: signupCnpj,
        company_name: signupCompanyName,
        role: "admin" as UserRole,
        plan: "none",
        max_colaboradores: 0,
      }], { onConflict: "id" });

      if (authData.session) {
        router.push("/planos");
      } else {
        setSignupSuccess("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      }
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally { setSignupLoading(false); }
  };

  /* ─── Login ─── */
  const handleLogin = async () => {
    setLoginError("");
    setForgotMsg("");
    if (!loginEmail || !loginPassword) {
      setLoginError("Por favor, preencha o e-mail e a senha.");
      return;
    }
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      
      router.push("/colaborador/chat");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Credenciais inválidas. Verifique seu e-mail e senha.");
    } finally {
      setLoginLoading(false);
    }
  };

  /* ─── Forgot ─── */
  const handleForgotPassword = async () => {
    if (!loginEmail) { setLoginError("Digite seu e-mail acima para recuperar a senha."); return; }
    setForgotLoading(true); setLoginError(""); setForgotMsg("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setForgotMsg("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
    } finally { setForgotLoading(false); }
  };

  const switchMode = (next: "signup" | "login") => {
    if (next === mode) return;
    onModeChange(next);
  };

  /* ─── Helpers do Slider de Signup ─── */
  const nextStep = () => {
    if (signupStep === 0 && signupPersonName.trim().length === 0) return;
    if (signupStep === 1 && (!signupEmail.includes("@") || !signupEmail.includes("."))) return;
    if (signupStep === 2 && (signupCnpj.replace(/\D/g, "").length !== 14 || signupCompanyName.trim().length === 0)) return;
    setSignupStep((s) => Math.min(s + 1, 3));
  };

  const prevStep = () => {
    setSignupStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-purple-200 bg-white shadow-2xl">
      {/* Tabs */}
      <div className="flex border-b border-purple-100">
        {(["signup", "login"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-5 transition-colors ${mode === tab ? "border-b-4 border-[#260054] font-bold text-[#260054]" : "font-medium text-[#4a4550] hover:bg-purple-50"
              }`}
            onClick={() => switchMode(tab)}
            type="button"
          >
            {tab === "signup" ? "Criar Conta" : "Entrar"}
          </button>
        ))}
      </div>

      {/* Panels (Signup/Login Slider) */}
      <div className="relative overflow-hidden transition-[height] duration-300">
        <div className="relative w-full">
          {/* ─── Signup Panel ─── */}
          <div 
            className={`w-full transition-all duration-500 ease-in-out px-6 py-8 sm:px-10 sm:py-10 flex flex-col ${
              mode === "signup" ? "relative translate-x-0 opacity-100 z-10" : "absolute top-0 left-0 -translate-x-full opacity-0 pointer-events-none z-0"
            }`}
          >
            <div className="relative w-full flex-1 mb-6">
              {/* Step 0: Nome */}
              <div 
                className={`w-full transition-all duration-500 ease-in-out space-y-4 ${
                  signupStep === 0 ? "relative translate-x-0 opacity-100 z-10" : "absolute top-0 left-0 opacity-0 pointer-events-none z-0 " + (signupStep > 0 ? "-translate-x-full" : "translate-x-full")
                }`}
              >
                <h3 className="text-[#260054] font-bold text-lg">Qual é o seu nome?</h3>
                  <Field 
                    label="Nome Completo" 
                    placeholder="Nome do responsável pela conta" 
                    type="text" 
                    value={signupPersonName} 
                    onChange={setSignupPersonName} 
                    onEnter={nextStep}
                  />
                </div>

              {/* Step 1: E-mail */}
              <div 
                className={`w-full transition-all duration-500 ease-in-out space-y-4 ${
                  signupStep === 1 ? "relative translate-x-0 opacity-100 z-10" : "absolute top-0 left-0 opacity-0 pointer-events-none z-0 " + (signupStep > 1 ? "-translate-x-full" : "translate-x-full")
                }`}
              >
                <h3 className="text-[#260054] font-bold text-lg">Seu melhor e-mail corporativo</h3>
                  <Field 
                    label="E-mail Corporativo" 
                    placeholder="nome@empresa.com.br" 
                    type="email" 
                    value={signupEmail} 
                    onChange={setSignupEmail} 
                    onEnter={nextStep}
                  />
                </div>

              {/* Step 2: CNPJ e Razão Social */}
              <div 
                className={`w-full transition-all duration-500 ease-in-out space-y-4 ${
                  signupStep === 2 ? "relative translate-x-0 opacity-100 z-10" : "absolute top-0 left-0 opacity-0 pointer-events-none z-0 " + (signupStep > 2 ? "-translate-x-full" : "translate-x-full")
                }`}
              >
                <h3 className="text-[#260054] font-bold text-lg">Dados da Empresa</h3>
                  <div className="space-y-1">
                    <Field 
                      label="CNPJ da Empresa" 
                      placeholder="00.000.000/0000-00" 
                      type="text" 
                      value={signupCnpj} 
                      onChange={(v) => {
                        let val = v.replace(/\D/g, "");
                        if (val.length > 14) val = val.slice(0, 14);
                        val = val.replace(/^(\d{2})(\d)/, "$1.$2");
                        val = val.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
                        val = val.replace(/\.(\d{3})(\d)/, ".$1/$2");
                        val = val.replace(/(\d{4})(\d)/, "$1-$2");
                        setSignupCnpj(val);
                        
                        if (val.replace(/\D/g, "").length === 14) {
                          fetchCnpjData(val);
                        } else {
                          setCnpjError("");
                        }
                      }} 
                    />
                    {cnpjSearching && <p className="text-[10px] font-medium text-purple-600 animate-pulse">Buscando dados na Receita Federal...</p>}
                    {cnpjError && <p className="text-[10px] font-medium text-red-500">{cnpjError}</p>}
                  </div>
                  
                  <AnimatedWrapper delay={100}>
                    <Field 
                      label="Razão Social / Nome Fantasia" 
                      placeholder="Auto-preenchido pelo CNPJ" 
                      type="text" 
                      value={signupCompanyName} 
                      onChange={setSignupCompanyName} 
                      disabled={cnpjSearching}
                    />
                  </AnimatedWrapper>
                </div>

              {/* Step 3: Senha e Finalizar */}
              <div 
                className={`w-full transition-all duration-500 ease-in-out space-y-4 ${
                  signupStep === 3 ? "relative translate-x-0 opacity-100 z-10" : "absolute top-0 left-0 opacity-0 pointer-events-none z-0 " + (signupStep > 3 ? "-translate-x-full" : "translate-x-full")
                }`}
              >
                <h3 className="text-[#260054] font-bold text-lg">Crie uma senha forte</h3>
                  <Field 
                    label="Senha" 
                    placeholder="Mínimo 8 caracteres" 
                    type="password" 
                    value={signupPassword} 
                    onChange={setSignupPassword} 
                    onEnter={handleSignup} 
                  />
                  {signupError && <Msg type="error" text={signupError} />}
                  {signupSuccess && <Msg type="success" text={signupSuccess} />}
                </div>
            </div>

            {/* Navegação do Slider */}
            <div className="flex items-center justify-between mt-auto">
              {signupStep > 0 ? (
                <button 
                  onClick={prevStep}
                  className="p-3 text-[#4a4550] hover:text-[#260054] hover:bg-purple-50 rounded-full transition-colors flex items-center justify-center"
                  type="button"
                  title="Voltar etapa"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
              ) : <div className="w-12" />}

              {/* Indicadores */}
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((step) => (
                  <div key={step} className={`h-2 rounded-full transition-all duration-300 ${signupStep === step ? "w-6 bg-[#3d1a6e]" : "w-2 bg-purple-200"}`} />
                ))}
              </div>

              {signupStep < 3 ? (
                <button 
                  onClick={nextStep}
                  className="p-3 text-white bg-[#3d1a6e] hover:bg-[#2D1052] rounded-full transition-colors flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  title="Próxima etapa"
                  disabled={
                    (signupStep === 0 && signupPersonName.trim().length === 0) ||
                    (signupStep === 1 && (!signupEmail.includes("@") || !signupEmail.includes("."))) ||
                    (signupStep === 2 && (signupCnpj.replace(/\D/g, "").length !== 14 || signupCompanyName.trim().length === 0))
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ) : (
                <button
                  onClick={handleSignup}
                  disabled={signupLoading}
                  className="px-6 py-3 bg-[#3d1a6e] text-white font-bold rounded-xl hover:bg-[#2D1052] hover:shadow-lg transition-all disabled:opacity-60 text-sm"
                  type="button"
                >
                  {signupLoading ? "Criando..." : "Criar Conta"}
                </button>
              )}
            </div>
          </div>

          {/* ─── Login Panel ─── */}
          <div 
            className={`w-full transition-all duration-500 ease-in-out space-y-4 px-6 py-8 sm:px-10 sm:py-10 ${
              mode === "login" ? "relative translate-x-0 opacity-100 z-10" : "absolute top-0 left-0 translate-x-full opacity-0 pointer-events-none z-0"
            }`}
          >
            <Field label="E-mail" placeholder="nome@empresa.com.br" type="email" value={loginEmail} onChange={setLoginEmail} />
            <Field label="Senha" placeholder="••••••••" type="password" value={loginPassword} onChange={setLoginPassword} onEnter={handleLogin} />
            {loginError && <Msg type="error" text={loginError} />}
            {forgotMsg && <Msg type="success" text={forgotMsg} />}
            <Btn onClick={handleLogin} loading={loginLoading} label="Entrar" loadingLabel="Entrando..." />
            <button
              className="w-full text-sm text-[#260054]/80 hover:underline disabled:opacity-50"
              type="button" disabled={forgotLoading} onClick={handleForgotPassword}
            >
              {forgotLoading ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function Field({ label, placeholder, type, value, onChange, onEnter, disabled }: {
  label: string; placeholder: string; type: string; value: string;
  onChange: (v: string) => void; onEnter?: () => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[#4a4550]">{label}</label>
      <input
        className={`w-full rounded-xl border px-4 py-3 outline-none transition-all focus:ring-2 ${disabled ? "bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed" : "border-[#ccc3d2] focus:border-[#6b538c] focus:ring-[#dabdfe]"
          }`}
        placeholder={placeholder} type={type} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
      />
    </div>
  );
}

function Msg({ type, text }: { type: "error" | "success"; text: string }) {
  return (
    <p className={`rounded-lg px-4 py-3 text-sm ${type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
      {text}
    </p>
  );
}

function Btn({ onClick, loading, label, loadingLabel }: {
  onClick: () => void; loading: boolean; label: string; loadingLabel: string;
}) {
  return (
    <button
      className="w-full rounded-xl bg-[#3d1a6e] py-4 font-bold text-white transition-all hover:bg-[#2D1052] hover:shadow-lg disabled:opacity-60"
      type="button" disabled={loading} onClick={onClick}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

/* ─── Componente Animado via Anime.js ─── */
function AnimatedWrapper({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elRef.current) {
      animate(elRef.current, {
        y: [-20, 0],
        opacity: [0, 1],
        duration: 800,
        ease: "outElastic(1, .8)",
        delay: delay,
      });
    }
  }, [delay]);

  return <div ref={elRef} className="opacity-0">{children}</div>;
}

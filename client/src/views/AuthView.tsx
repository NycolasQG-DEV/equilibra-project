import React, { useState } from 'react';
import { post } from '../core/api';
import type { Account } from '../../../types';

interface AuthViewProps {
  onLogin: (account: Account & { token?: string }) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && (!name.trim() || !company.trim())) {
      setError('Informe seu nome e o nome da empresa.');
      return;
    }
    if (password.length < 10) {
      setError('A senha deve ter pelo menos 10 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : { email, password, name, company };

      const account = await post<Account & { token?: string }>(endpoint, payload);
      onLogin(account);
    } catch (err: any) {
      setError(err?.message || 'Erro de autenticação. Verifique os dados informados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-bg">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo e Branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white text-xl mb-3 shadow-sm">
            <i className="fa-solid fa-scale-balanced" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold color-text-primary tracking-tight m-0">Equilibra</h1>
          <p className="text-xs color-text-secondary mt-1">Gestão Integrada de Riscos Psicossociais · NR-1 / NR-17</p>
        </div>

        {/* Card de Auth */}
        <div className="auth-card-elevated space-y-4">
          {/* Tabs de Modo */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(null); }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(null); }}
            >
              Criar Conta
            </button>
          </div>

          {error && (
            <div className="p-3 bg-danger-subtle border border-danger rounded-lg text-xs text-danger flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Seu Nome *</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Nome do responsável SST / RH"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs font-semibold block mb-1">Nome da Empresa *</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    placeholder="Razão social ou nome fantasia"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="label text-xs font-semibold block mb-1">E-mail *</label>
              <input
                type="email"
                className="input w-full text-sm"
                placeholder="gestor@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={mode === 'login'}
                required
              />
            </div>

            <div>
              <label className="label text-xs font-semibold block mb-1">Senha *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input w-full text-sm pr-10"
                  placeholder="Mínimo de 10 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                />
                <button
                  type="button"
                  className="btn-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full font-semibold"
              disabled={loading}
            >
              {loading ? (
                <><i className="fa-solid fa-spinner fa-spin mr-2" aria-hidden="true" /> Aguarde...</>
              ) : mode === 'login' ? (
                <><i className="fa-solid fa-right-to-bracket mr-2" aria-hidden="true" /> Entrar na Plataforma</>
              ) : (
                <><i className="fa-solid fa-user-plus mr-2" aria-hidden="true" /> Criar Conta & Começar</>
              )}
            </button>
          </form>

          {/* Aviso LGPD / Conformidade */}
          <div className="pt-2 border-t border-border text-[11px] color-text-muted text-center">
            <p>Dados tratados em conformidade com a <strong>LGPD</strong> e <strong>NR-1</strong>.</p>
            <p>Sigilo individual garantido. Resultados consolidados por setor (mín. 5 respondentes).</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Authentication view: Login and Register */

import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { showToast } from '../../ui/toast.js';
import { field } from '../../ui/fields.js';
import { esc, attr } from '../../domain/formatters.js';
import { roleLabels } from '../../domain/labels.js';

// ── Shared header ──────────────────────────────────────────────────────────
function authHeader(subtitle) {
  return `
    <div class="auth-card-header">
      <div class="auth-logo">
        <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>
      </div>
      <h1 class="card-title text-center">Equilibra</h1>
      <p class="view-subtitle text-center">${subtitle}</p>
    </div>
  `;
}

// ── Login ──────────────────────────────────────────────────────────────────
export function renderLogin() {
  return `
    <div class="center-page-wrap">
      <div class="card auth-card">
        ${authHeader('Escuta coletiva confidencial &amp; gestão de SST')}
        <div class="card-body">
          <form id="login-form" data-action="submit-login">
            ${field({
              id: 'login-email',
              name: 'email',
              label: 'E-mail corporativo',
              type: 'email',
              required: true,
              placeholder: 'ex: gestor@empresa.com.br'
            })}
            ${field({
              id: 'login-password',
              name: 'password',
              label: 'Senha',
              type: 'password',
              required: true,
              placeholder: '••••••••'
            })}
            <button type="submit" id="btn-login-submit" class="btn btn-primary w-full mt-4">
              <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
              Entrar na plataforma
            </button>
          </form>
        </div>
        <div class="card-footer auth-footer">
          <p>Ainda não tem conta?
            <a href="#registro" class="link">Criar conta gratuita</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function handleLoginSubmit(form) {
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const email = form.email?.value?.trim();
  const password = form.password?.value;

  if (!email || !password) {
    showToast('Preencha e-mail e senha.', 'error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  try {
    await post('/auth/login', { email, password });
    await store.loadAccount();
    showToast('Login realizado com sucesso.', 'success');

    const nextPath = router.intendedRoute || 'hoje';
    router.intendedRoute = null;
    router.navigate(nextPath);
  } catch (err) {
    showToast(err.message || 'E-mail ou senha incorretos.', 'error');
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ── Register ───────────────────────────────────────────────────────────────
export function renderRegister({ state = store.getState() } = {}) {
  const invite = state.activeInvite;

  if (invite && invite.error) {
    return `
      <div class="center-page-wrap">
        <div class="card auth-card">
          ${authHeader('Convite de Equipe')}
          <div class="card-body">
            <div class="privacy-notice privacy-warning mb-4">
              <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <div>
                <strong>Convite inválido</strong>
                <p class="m-0 text-xs">${esc(invite.error)}</p>
              </div>
            </div>
            <p class="text-sm mb-4">
              Este convite expirou ou já foi utilizado. Solicite um novo link de convite ao administrador da sua empresa.
            </p>
            <a href="#login" class="btn btn-secondary w-full">Voltar para o Login</a>
          </div>
        </div>
      </div>
    `;
  }

  const isInvited = Boolean(invite && invite.email);
  const roleName = isInvited ? (roleLabels[invite.role] || invite.role) : '';

  return `
    <div class="center-page-wrap">
      <div class="card auth-card auth-card--wide">
        ${authHeader(isInvited ? 'Junte-se à equipe no Equilibra' : 'Crie sua conta e comece a organizar a escuta')}
        <div class="card-body">
          ${isInvited ? `
            <div class="privacy-notice privacy-info mb-4">
              <i class="fa-solid fa-envelope-open-text" aria-hidden="true"></i>
              <div>
                <strong>Convite de Equipe Confirmado</strong>
                <p class="m-0 text-xs">
                  Você foi convidado para a equipe de <strong>${esc(invite.company)}</strong> com o papel de <strong>${esc(roleName)}</strong>. Complete os dados para entrar.
                </p>
              </div>
            </div>
          ` : ''}

          <form id="register-form" data-action="submit-register">
            ${isInvited ? `<input type="hidden" name="invitationToken" value="${attr(invite.token)}" />` : ''}

            ${field({
              id: 'register-name',
              name: 'name',
              label: 'Seu nome completo',
              type: 'text',
              required: true,
              placeholder: 'ex: Ana Silva'
            })}
            ${field({
              id: 'register-company',
              name: 'company',
              label: 'Nome da empresa',
              type: 'text',
              required: true,
              value: isInvited ? (invite.company || '') : '',
              disabled: Boolean(isInvited),
              placeholder: 'ex: Empresa Ltda'
            })}
            ${field({
              id: 'register-email',
              name: 'email',
              label: isInvited ? 'E-mail corporativo convidado' : 'E-mail corporativo',
              type: 'email',
              required: true,
              value: isInvited ? (invite.email || '') : '',
              disabled: Boolean(isInvited),
              placeholder: 'ex: gestor@empresa.com.br'
            })}
            ${field({
              id: 'register-password',
              name: 'password',
              label: 'Senha (mínimo 10 caracteres)',
              type: 'password',
              required: true,
              placeholder: '••••••••••'
            })}
            ${field({
              id: 'register-password-confirm',
              name: 'passwordConfirm',
              label: 'Confirmar senha',
              type: 'password',
              required: true,
              placeholder: '••••••••••'
            })}
            <button type="submit" id="btn-register-submit" class="btn btn-primary w-full mt-4">
              <i class="fa-solid ${isInvited ? 'fa-right-to-bracket' : 'fa-user-plus'}" aria-hidden="true"></i>
              ${isInvited ? 'Aceitar Convite e Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
        <div class="card-footer auth-footer">
          <p>Já tem uma conta?
            <a href="#login" class="link">Entrar</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function handleRegisterSubmit(form) {
  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const activeInvite = store.getState().activeInvite;
  const invitationToken = form.invitationToken?.value || activeInvite?.token;
  const name = form.name?.value?.trim();
  const company = (form.company?.value?.trim()) || activeInvite?.company;
  const email = (form.email?.value?.trim()) || activeInvite?.email;
  const password = form.password?.value;
  const passwordConfirm = form.passwordConfirm?.value;

  if (!name || !company || !email || !password) {
    showToast('Preencha todos os campos obrigatórios.', 'error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  if (password.length < 10) {
    showToast('A senha deve ter pelo menos 10 caracteres.', 'error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  if (password !== passwordConfirm) {
    showToast('As senhas não conferem.', 'error');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  try {
    const payload = {
      name,
      company,
      email,
      password,
      ...(invitationToken ? { invitationToken } : {})
    };
    await post('/auth/register', payload);
    store.setState({ activeInvite: null });
    await store.loadAccount();
    showToast('Conta criada com sucesso! Bem-vindo(a) ao Equilibra.', 'success');
    router.navigate('hoje');
  } catch (err) {
    showToast(err.message || 'Erro ao criar conta. Tente novamente.', 'error');
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────
export async function handleLogout() {
  try {
    await post('/auth/logout');
  } catch { /* ignore */ }
  store.setState({ account: null });
  router.navigate('login');
  showToast('Sessão encerrada com segurança.', 'info');
}

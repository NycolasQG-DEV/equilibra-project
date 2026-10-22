/* Authentication view: Login and Register */

import { post } from '../../core/api.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { showToast } from '../../ui/toast.js';
import { field } from '../../ui/fields.js';

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
export function renderRegister() {
  return `
    <div class="center-page-wrap">
      <div class="card auth-card auth-card--wide">
        ${authHeader('Crie sua conta e comece a organizar a escuta')}
        <div class="card-body">
          <form id="register-form" data-action="submit-register">
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
              placeholder: 'ex: Empresa Ltda'
            })}
            ${field({
              id: 'register-email',
              name: 'email',
              label: 'E-mail corporativo',
              type: 'email',
              required: true,
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
              <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
              Criar conta
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

  const name = form.name?.value?.trim();
  const company = form.company?.value?.trim();
  const email = form.email?.value?.trim();
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
    await post('/auth/register', { name, company, email, password });
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

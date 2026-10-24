/* Declarative router: single source of truth for location.hash and view transitions */

import { store } from './store.js';

class Router {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.currentParams = {};
    this.intendedRoute = null;
    this.unsavedChangesGuard = null;
    this.container = null;
    this.announcer = null;
  }

  init(containerSelector = '#app', announcerSelector = null) {
    this.container = document.querySelector(containerSelector);
    this.announcer = announcerSelector ? document.querySelector(announcerSelector) : this.container;

    window.addEventListener('hashchange', () => this.handleHashChange());
    window.addEventListener('popstate', () => this.handleHashChange());

    // Auto-refresh the view whenever store state updates (no F5 needed)
    let renderScheduled = false;
    store.subscribe(() => {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        if (this.currentRoute && !['login', 'registro'].includes(this.currentRoute.path) && !this.currentRoute.path.startsWith('responder')) {
          this.refresh();
        }
      });
    });
  }

  register(routeDef) {
    // routeDef: { path, title, roles, load, render, breadcrumb }
    this.routes.push(routeDef);
  }

  setUnsavedChangesGuard(guardFn) {
    this.unsavedChangesGuard = guardFn;
  }

  navigate(path, { replace = false } = {}) {
    if (this.unsavedChangesGuard && !this.unsavedChangesGuard()) {
      const confirmLeave = window.confirm('Você tem alterações não salvas. Deseja sair desta página e descartar as alterações?');
      if (!confirmLeave) return;
    }

    const cleanPath = path.replace(/^#/, '');
    if (replace) {
      window.history.replaceState(null, '', `#${cleanPath}`);
      // replaceState does NOT fire hashchange — dispatch it manually so the
      // router picks up the new hash and renders the correct view.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = cleanPath;
    }
  }

  matchRoute(hash) {
    const cleanHash = hash.replace(/^#\/?/, '').split('?')[0] || 'hoje';

    for (const route of this.routes) {
      const paramNames = [];
      const regexPath = route.path
        .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
          paramNames.push(name);
          return '([^/]+)';
        })
        .replace(/\//g, '\\/');

      const match = cleanHash.match(new RegExp(`^${regexPath}$`));
      if (match) {
        const params = {};
        paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { route, params, rawPath: cleanHash };
      }
    }

    return null;
  }

  async handleHashChange() {
    const rawHash = window.location.hash;
    const match = this.matchRoute(rawHash);

    if (!match) {
      this.renderNotFound();
      return;
    }

    const { route, params, rawPath } = match;
    const state = store.getState();

    // ── Public routes ──
    const isPublic = route.path.startsWith('responder') || route.path === 'login' || route.path === 'registro';

    // ── Auth guard ──
    if (!isPublic && !state.account) {
      this.intendedRoute = rawPath;
      this.navigate('login', { replace: true });
      return;
    }

    // ── Role guard ──
    if (route.roles && state.account && !route.roles.includes(state.account.role)) {
      this.renderForbidden(route);
      return;
    }

    this.currentRoute = route;
    this.currentParams = params;

    // ── Update Document Title ──
    const pageTitle = typeof route.title === 'function' ? route.title(params, state) : route.title;
    document.title = pageTitle ? `${pageTitle} | Equilibra` : 'Equilibra';

    // ── Load data if required ──
    if (typeof route.load === 'function') {
      try {
        await route.load(params, state);
      } catch (err) {
        console.error('Error loading route data:', err);
      }
    }

    // ── Render view ──
    if (this.container && typeof route.render === 'function') {
      try {
        const html = route.render({
          params,
          state: store.getState(),
          router: this
        });
        this.container.innerHTML = html;

        // ── Post-render lifecycle ──
        if (typeof route.mounted === 'function') {
          try {
            route.mounted({ params, state: store.getState(), router: this });
          } catch (err) {
            console.error('Error mounting route:', err);
          }
        }
      } catch (renderErr) {
        console.error('Error rendering route:', renderErr);
        this.container.innerHTML = `
          <div class="empty-state p-8">
            <h2 class="view-title color-danger">Erro ao carregar a página</h2>
            <p class="empty-text">${renderErr.message || 'Ocorreu um erro ao processar esta visualização.'}</p>
            <a href="#pesquisas" class="btn btn-primary mt-4">Voltar para Pesquisas</a>
          </div>
        `;
      }

      // ── Restore Scroll & Focus Accessibility ──
      window.scrollTo(0, 0);
      const h1 = this.container.querySelector('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus();
      }

      // Announce for assistive technology
      if (this.announcer && pageTitle) {
        this.announcer.setAttribute('aria-label', `Página: ${pageTitle}`);
      }
    }
  }

  refresh() {
    if (!this.container || !this.currentRoute || typeof this.currentRoute.render !== 'function') return;

    const scrollY = window.scrollY;
    const html = this.currentRoute.render({
      params: this.currentParams,
      state: store.getState(),
      router: this
    });
    this.container.innerHTML = html;

    if (typeof this.currentRoute.mounted === 'function') {
      try {
        this.currentRoute.mounted({ params: this.currentParams, state: store.getState(), router: this });
      } catch (err) {
        console.error('Error mounting route on refresh:', err);
      }
    }

    window.scrollTo(0, scrollY);
  }

  renderNotFound() {
    document.title = 'Página não encontrada | Equilibra';
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="app-shell">
        <main class="app-main">
          <section class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></div>
            <h1 class="empty-title">Página não encontrada</h1>
            <p class="empty-text">O endereço acessado não existe ou foi modificado.</p>
            <button type="button" class="btn btn-primary" data-action="navigate" data-path="hoje">
              Ir para a Visão Geral
            </button>
          </section>
        </main>
      </div>
    `;
    const h1 = this.container.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus();
    }
  }

  renderForbidden(route) {
    document.title = 'Acesso restrito | Equilibra';
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="app-shell">
        <main class="app-main">
          <section class="empty-state">
            <div class="empty-icon"><i class="fa-solid fa-lock" aria-hidden="true"></i></div>
            <h1 class="empty-title">Acesso restrito</h1>
            <p class="empty-text">Seu perfil de acesso atual (Consulta) não possui permissão para gerenciar esta seção.</p>
            <button type="button" class="btn btn-primary" data-action="navigate" data-path="hoje">
              Voltar à Visão Geral
            </button>
          </section>
        </main>
      </div>
    `;
    const h1 = this.container.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus();
    }
  }
}

export const router = new Router();

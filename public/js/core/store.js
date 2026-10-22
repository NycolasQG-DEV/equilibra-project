/* Reactive state container with sectional loading */

import { get, post } from './api.js';

const initialState = {
  account: null,
  meta: null,
  members: [],
  groups: [],
  surveys: [],
  reports: [],
  today: null,
  management: {
    actions: [],
    assessments: [],
    collaborators: [],
    retention: null
  },
  team: { users: [], invitations: [] },
  activeCycleContext: null, // { surveyId, title, cycle, status }
  filterGroupId: null,
  loading: {
    account: false,
    today: false,
    surveys: false,
    reports: false,
    organization: false,
    management: false,
    team: false
  },
  errors: {}
};

class Store {
  constructor() {
    this.state = { ...initialState };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  setLoading(section, isLoading) {
    this.state.loading = { ...this.state.loading, [section]: isLoading };
    this.notify();
  }

  setError(section, error) {
    this.state.errors = { ...this.state.errors, [section]: error };
    this.notify();
  }

  clearError(section) {
    if (this.state.errors[section]) {
      const next = { ...this.state.errors };
      delete next[section];
      this.state.errors = next;
      this.notify();
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    }
  }

  // ── Sectional Loaders ──
  async loadAccount() {
    this.setLoading('account', true);
    try {
      const account = await get('/auth/me');
      this.setState({ account: account || null });
      this.clearError('account');
      return account;
    } catch (err) {
      if (err.status === 401 || err.status === 404) {
        this.setState({ account: null });
      } else {
        this.setError('account', err);
      }
      return null;
    } finally {
      this.setLoading('account', false);
    }
  }

  async loadToday() {
    this.setLoading('today', true);
    try {
      const today = await get('/today');
      this.setState({ today });
      this.clearError('today');
      return today;
    } catch (err) {
      this.setError('today', err);
      return null;
    } finally {
      this.setLoading('today', false);
    }
  }

  async loadSurveys() {
    this.setLoading('surveys', true);
    try {
      const surveys = await get('/surveys');
      this.setState({ surveys });
      this.clearError('surveys');
      return surveys;
    } catch (err) {
      this.setError('surveys', err);
      return [];
    } finally {
      this.setLoading('surveys', false);
    }
  }

  async loadReports() {
    this.setLoading('reports', true);
    try {
      const reports = await get('/reports');
      this.setState({ reports });
      this.clearError('reports');
      return reports;
    } catch (err) {
      this.setError('reports', err);
      return [];
    } finally {
      this.setLoading('reports', false);
    }
  }

  async loadOrganization() {
    this.setLoading('organization', true);
    try {
      const [members, groups] = await Promise.all([
        get('/members'),
        get('/groups')
      ]);
      this.setState({ members, groups });
      this.clearError('organization');
      return { members, groups };
    } catch (err) {
      this.setError('organization', err);
      return { members: [], groups: [] };
    } finally {
      this.setLoading('organization', false);
    }
  }

  async loadManagement() {
    this.setLoading('management', true);
    try {
      const management = await get('/management/workspace');
      this.setState({ management });
      this.clearError('management');
      return management;
    } catch (err) {
      this.setError('management', err);
      return null;
    } finally {
      this.setLoading('management', false);
    }
  }

  async loadTeam() {
    this.setLoading('team', true);
    try {
      const team = await get('/management/team');
      this.setState({ team });
      this.clearError('team');
      return team;
    } catch (err) {
      this.setError('team', err);
      return { users: [], invitations: [] };
    } finally {
      this.setLoading('team', false);
    }
  }

  async loadMeta() {
    try {
      const meta = await get('/meta');
      this.setState({ meta });
      return meta;
    } catch (err) {
      console.error('Error loading meta:', err);
      return null;
    }
  }

  setCycleContext(context) {
    const current = this.state.activeCycleContext;
    if (
      current &&
      context &&
      current.reportId === context.reportId &&
      current.surveyId === context.surveyId &&
      current.title === context.title &&
      current.cycle === context.cycle &&
      current.status === context.status
    ) {
      return;
    }
    this.setState({ activeCycleContext: context });
  }

  clearCycleContext() {
    if (!this.state.activeCycleContext) return;
    this.setState({ activeCycleContext: null });
  }
}

export const store = new Store();

// src/utils/api.js
// Centralised API client for ADMRI backend
// Drop-in replacement for localStorage calls in storage.js

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Token management ──────────────────────────────────────────────────────────
const Tokens = {
  getAccess:       () => localStorage.getItem('admri_access_token'),
  getRefresh:      () => localStorage.getItem('admri_refresh_token'),
  set: (access, refresh) => {
    localStorage.setItem('admri_access_token',  access);
    if (refresh) localStorage.setItem('admri_refresh_token', refresh);
  },
  clear: () => {
    localStorage.removeItem('admri_access_token');
    localStorage.removeItem('admri_refresh_token');
  },
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

async function request(method, path, body = null, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Tokens.getAccess();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = {
    method,
    headers,
    signal: opts.signal,
  };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, config);

  // Auto-refresh on 401 TOKEN_EXPIRED
  if (res.status === 401) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.code === 'TOKEN_EXPIRED' && !opts._retry) {
      if (isRefreshing) {
        // Queue concurrent requests until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => request(method, path, body, { ...opts, _retry: true }));
      }
      isRefreshing = true;
      try {
        const refreshed = await refreshTokens();
        if (refreshed) {
          refreshQueue.forEach(p => p.resolve());
          refreshQueue = [];
          return request(method, path, body, { ...opts, _retry: true });
        }
      } finally {
        isRefreshing = false;
      }
      // Refresh failed — redirect to login
      Tokens.clear();
      window.location.href = '/';
      throw new Error('Session expired');
    }
    const err = new Error(data.error || 'Unauthorized');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.fields = data.fields;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}

async function refreshTokens() {
  const refresh = Tokens.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const { tokens } = await res.json();
    Tokens.set(tokens.access, tokens.refresh);
    return true;
  } catch {
    return false;
  }
}

const get    = (path, opts)        => request('GET',    path, null, opts);
const post   = (path, body, opts)  => request('POST',   path, body, opts);
const patch  = (path, body, opts)  => request('PATCH',  path, body, opts);
const del    = (path, opts)        => request('DELETE', path, null, opts);

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const Auth = {
  async register(data) {
    const res = await post('/auth/register', data);
    Tokens.set(res.tokens.access, res.tokens.refresh);
    return res.doctor;
  },

  async login(email, password) {
    const res = await post('/auth/login', { email, password });
    Tokens.set(res.tokens.access, res.tokens.refresh);
    return res.doctor;
  },

  async logout(allDevices = false) {
    try {
      await post('/auth/logout', {
        refresh_token: Tokens.getRefresh(),
        all_devices:   allDevices,
      });
    } finally {
      Tokens.clear();
    }
  },

  async getMe()                    { return (await get('/auth/me')).doctor; },
  async updateMe(data)             { return (await patch('/auth/me', data)).doctor; },
  async changePassword(current, next) {
    return post('/auth/change-password', { current_password: current, new_password: next });
  },

  isLoggedIn: () => !!Tokens.getAccess(),
};

// ── PATIENTS ──────────────────────────────────────────────────────────────────
export const Patients = {
  list(params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return get(`/patients${qs ? '?' + qs : ''}`);
  },

  get(id)          { return get(`/patients/${id}`).then(r => r.patient); },
  create(data)     { return post('/patients', data).then(r => r.patient); },
  update(id, data) { return patch(`/patients/${id}`, data).then(r => r.patient); },
  delete(id)       { return del(`/patients/${id}`); },

  getRiskHistory(id) {
    return get(`/patients/${id}/risk-history`).then(r => r.history);
  },
};

// ── ASSESSMENTS ───────────────────────────────────────────────────────────────
export const Assessments = {
  list(patientId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return get(`/patients/${patientId}/assessments${qs ? '?' + qs : ''}`);
  },

  get(patientId, id) {
    return get(`/patients/${patientId}/assessments/${id}`).then(r => r.assessment);
  },

  create(patientId, data) {
    return post(`/patients/${patientId}/assessments`, data).then(r => r.assessment);
  },

  delete(patientId, id) {
    return del(`/patients/${patientId}/assessments/${id}`);
  },
};

// ── NOTES ─────────────────────────────────────────────────────────────────────
export const Notes = {
  list(patientId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return get(`/patients/${patientId}/notes${qs ? '?' + qs : ''}`);
  },

  create(patientId, data) {
    return post(`/patients/${patientId}/notes`, data).then(r => r.note);
  },

  update(patientId, id, data) {
    return patch(`/patients/${patientId}/notes/${id}`, data).then(r => r.note);
  },

  delete(patientId, id) {
    return del(`/patients/${patientId}/notes/${id}`);
  },
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const Dashboard = {
  getStats() { return get('/dashboard/stats'); },
};

// ── ALERTS ────────────────────────────────────────────────────────────────────
export const Alerts = {
  list() { return get('/alerts').then(r => r.alerts); },
};

const API = { Auth, Patients, Assessments, Notes, Dashboard, Alerts };
export default API;

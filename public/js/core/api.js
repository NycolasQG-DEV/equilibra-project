/* Centralized API client with categorized errors and retry capability */

import { AppError } from './errors.js';

let authFailureHandler = null;

export function setAuthFailureHandler(handler) {
  authFailureHandler = handler;
}

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') || endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    credentials: 'same-origin',
    ...options,
    headers
  };

  try {
    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      let errorBody = {};
      try {
        errorBody = await res.json();
      } catch {
        errorBody = { error: res.statusText || 'Erro na requisição' };
      }

      const errorMessage = errorBody.error || errorBody.message || `Erro ${res.status}`;
      const appErr = new AppError(errorMessage, {
        status: res.status,
        code: errorBody.code || `HTTP_${res.status}`,
        details: errorBody.details || errorBody.errors || null,
        recoverable: res.status >= 500 || res.status === 0,
        retry: () => request(endpoint, options)
      });

      if (res.status === 401) {
        if (typeof authFailureHandler === 'function' && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          authFailureHandler(appErr);
        }
      }

      throw appErr;
    }

    if (res.status === 204) {
      return null;
    }

    return await res.json();
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    // Network / offline error
    throw new AppError('Falha de conexão com o servidor. Verifique sua rede e tente novamente.', {
      status: 0,
      code: 'NETWORK_ERROR',
      recoverable: true,
      retry: () => request(endpoint, options)
    });
  }
}

export const get = (url, opts) => request(url, { ...opts, method: 'GET' });
export const post = (url, body = {}, opts) => request(url, { ...opts, method: 'POST', body: JSON.stringify(body) });
export const put = (url, body = {}, opts) => request(url, { ...opts, method: 'PUT', body: JSON.stringify(body) });
export const del = (url, opts) => request(url, { ...opts, method: 'DELETE' });

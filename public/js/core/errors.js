/* Error classification and friendly message handling */

export class AppError extends Error {
  constructor(message, { status = 500, code = 'UNKNOWN_ERROR', details = null, recoverable = true, retry = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.recoverable = recoverable;
    this.retry = retry;
  }
}

export function formatErrorMessage(err) {
  if (!err) return 'Ocorreu um erro inesperado.';
  if (err.status === 401) {
    return 'Sua sessão expirou. Por favor, autentique-se novamente.';
  }
  if (err.status === 403) {
    return 'Seu perfil de acesso não tem permissão para realizar esta operação.';
  }
  if (err.status === 404) {
    return 'O recurso solicitado não foi encontrado ou não está disponível.';
  }
  if (err.status === 409 || err.status === 422) {
    return err.message || 'Verifique as informações preenchidas e tente novamente.';
  }
  if (err.status === 0 || err.code === 'NETWORK_ERROR') {
    return 'Falha de conexão com o servidor. Verifique sua rede e tente novamente.';
  }
  if (err.status >= 500) {
    return 'O servidor encontrou uma instabilidade temporária. Os seus dados não foram perdidos.';
  }
  return err.message || 'Não foi possível completar a operação. Tente novamente.';
}

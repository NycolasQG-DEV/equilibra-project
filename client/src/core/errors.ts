/**
 * Classificação e mensagens amigáveis de erros
 */

export interface AppErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  recoverable?: boolean;
  retry?: (() => Promise<unknown>) | null;
}

export class AppError extends Error {
  status: number;
  code: string;
  details: unknown;
  recoverable: boolean;
  retry: (() => Promise<unknown>) | null;

  constructor(
    message: string,
    { status = 500, code = 'UNKNOWN_ERROR', details = null, recoverable = true, retry = null }: AppErrorOptions = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.recoverable = recoverable;
    this.retry = retry;
  }
}

export function formatErrorMessage(err: unknown): string {
  if (!err) return 'Ocorreu um erro inesperado.';
  const errorObj = err as Partial<AppError> & { message?: string };
  if (errorObj.status === 401) {
    return 'Sua sessão expirou. Por favor, autentique-se novamente.';
  }
  if (errorObj.status === 403) {
    return 'Seu perfil de acesso não tem permissão para realizar esta operação.';
  }
  if (errorObj.status === 404) {
    return 'O recurso solicitado não foi encontrado ou não está disponível.';
  }
  if (errorObj.status === 409 || errorObj.status === 422) {
    return errorObj.message || 'Verifique as informações preenchidas e tente novamente.';
  }
  if (errorObj.status === 0 || errorObj.code === 'NETWORK_ERROR') {
    return 'Falha de conexão com o servidor. Verifique sua rede e tente novamente.';
  }
  if (typeof errorObj.status === 'number' && errorObj.status >= 500) {
    return 'O servidor encontrou uma instabilidade temporária. Os seus dados não foram perdidos.';
  }
  return errorObj.message || 'Não foi possível completar a operação. Tente novamente.';
}

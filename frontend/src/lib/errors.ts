export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const GENERIC_ERROR_MESSAGE = 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}
import type { ErrorCode } from '../types/api';

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

/** Sözleşmedeki `code` değerleri için kullanıcıya gösterilecek Türkçe mesajlar. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NOT_AUTHENTICATED: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
  GAME_NOT_FOUND: 'Oyun bulunamadı.',
  SESSION_NOT_FOUND: 'Oturum bulunamadı.',
  INVALID_SESSION_COUNT: 'Oturum sayısı izin verilen aralığın dışında.',
  SIDE_ALREADY_CHOSEN: 'Bu oturum için taraf zaten seçilmiş.',
  NOT_YOUR_TURN: 'Şu anda söz sırası sizde değil.',
  SESSION_NOT_ACTIVE: 'Bu oturum şu anda bu işleme açık değil.',
  GAME_FINISHED: 'Bu oyun zaten tamamlandı.',
  GAME_NOT_FINISHED: 'Sonuçlar, oyun tamamlandığında hazır olur.',
  OPPONENT_UNAVAILABLE: 'Rakip şu anda yanıt veremiyor. Argümanınız kaydedildi; tekrar deneyin.',
  EVALUATION_FAILED: 'Hakem değerlendirmesi tamamlanamadı. Metrikler değişmedi; tekrar deneyin.',
  EVALUATION_NOT_READY: 'Bu oturumun hakem kararı henüz hazır değil.',
};

/** `code` taşımayan backend yanıtları (ör. kayıt çakışmaları) için `detail` eşlemesi. */
const DETAIL_MESSAGES: Record<string, string> = {
  'Email already registered': 'Bu e-posta adresiyle zaten bir hesap var.',
  'Username already taken': 'Bu kullanıcı adı alınmış.',
  'Email already registered or username already taken':
    'Bu e-posta adresi veya kullanıcı adı zaten kullanılıyor.',
  'Wrong email or password': 'E-posta veya şifre hatalı.',
  'Game not found': ERROR_MESSAGES.GAME_NOT_FOUND,
  'Session not found': ERROR_MESSAGES.SESSION_NOT_FOUND,
  // FastAPI'nin tanımsız yol yanıtı: endpoint backend'de henüz yok (x-status: planned).
  'Not Found': 'Bu özellik sunucuda henüz kullanılamıyor.',
};

const STATUS_MESSAGES: Record<number, string> = {
  0: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.',
  401: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
  404: 'Aradığınız kayıt bulunamadı.',
  422: 'Gönderilen bilgiler geçersiz. Lütfen alanları kontrol edin.',
  503: 'Servis şu anda yanıt veremiyor. Lütfen biraz sonra tekrar deneyin.',
};

/** FastAPI 422 yanıtındaki alan adları (`loc` son öğesi) için mesajlar. */
const FIELD_MESSAGES: Record<string, string> = {
  email: 'E-posta adresi geçersiz. (.test gibi ayrılmış alan adları kabul edilmez.)',
  username: 'Kullanıcı adı 3-30 karakter olmalı; yalnızca harf, rakam, "_" ve "." içerebilir.',
  password: 'Şifre en az 8 karakter olmalıdır.',
  text: 'Argümanınız boş olamaz ve izin verilen uzunluğu aşamaz.',
};

function validationMessage(detail: unknown[]): string | null {
  const messages = detail.flatMap((item) => {
    const loc = (item as { loc?: unknown[] }).loc;
    const field = Array.isArray(loc) ? String(loc[loc.length - 1]) : '';
    return field in FIELD_MESSAGES ? [FIELD_MESSAGES[field]] : [];
  });
  return messages.length > 0 ? [...new Set(messages)].join(' ') : null;
}

export function messageFor(status: number, code?: string, detail?: unknown): string {
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code as ErrorCode];
  }
  if (typeof detail === 'string' && detail in DETAIL_MESSAGES) {
    return DETAIL_MESSAGES[detail];
  }
  if (Array.isArray(detail)) {
    const message = validationMessage(detail);
    if (message) return message;
  }
  return STATUS_MESSAGES[status] ?? 'İşlem sırasında bir hata oluştu.';
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

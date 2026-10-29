import axios, { type AxiosError } from 'axios';
import { env } from './env';
import { ApiError } from './errors';
import { tokenStorage } from './tokenStorage';
import type { ApiErrorBody } from '../types/api';

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;

    if (status === 401) {
      tokenStorage.clear();
    }

    const message =
      body?.message ??
      (status === 0
        ? 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.'
        : 'İşlem sırasında bir hata oluştu.');

    return Promise.reject(new ApiError(status, body?.code ?? 'REQUEST_FAILED', message));
  },
);
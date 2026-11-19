import axios, { type AxiosError } from 'axios';
import { env } from './env';
import { ApiError, messageFor } from './errors';
import { tokenStorage } from './tokenStorage';
import type { ApiErrorBody } from '../types/api';

/** Token geçersizleştiğinde yayınlanır; AuthContext dinleyip oturumu kapatır. */
export const UNAUTHORIZED_EVENT = 'kursu:unauthorized';

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

    if (status === 401 && tokenStorage.get()) {
      tokenStorage.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    const code = body?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'REQUEST_FAILED');
    return Promise.reject(new ApiError(status, code, messageFor(status, body?.code, body?.detail)));
  },
);

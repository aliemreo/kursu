import { env } from '../lib/env';
import { mockApi } from '../mocks/mockApi';
import { liveApi } from './liveApi';
import type { KursuApi } from './contracts';

/**
 * Uygulamanın tek veri giriş noktası. VITE_USE_MOCKS değerine göre
 * mock veya gerçek API seçilir. Ekranlar bu dosyadan import eder.
 */
export const api: KursuApi = env.useMocks ? mockApi : liveApi;

export const isMockMode = env.useMocks;
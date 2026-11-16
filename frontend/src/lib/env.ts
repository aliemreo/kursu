const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value.trim().toLowerCase() === 'true';
};

export const env = {
  /**
   * API'nin kök adresi. Varsayılan "/api": geliştirmede Vite, Docker'da Nginx bu yolu
   * backend'in /api/v1 önekine yönlendirir. Doğrudan bir adres verilecekse sürüm de
   * eklenmelidir, ör. http://localhost:8000/api/v1.
   */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  useMocks: parseBoolean(import.meta.env.VITE_USE_MOCKS, true),
} as const;

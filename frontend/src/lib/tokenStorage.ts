const TOKEN_KEY = 'kursu.accessToken';

export const tokenStorage = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* Depolama kullanılamıyorsa oturum yalnızca bellekte kalmaz; sayfa yenilenince giriş gerekir. */
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* yoksay */
    }
  },
};
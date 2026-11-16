import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { UNAUTHORIZED_EVENT } from '../../lib/httpClient';
import { tokenStorage } from '../../lib/tokenStorage';
import { api } from '../../services';
import type { Credentials, Registration, User } from '../../types/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: Credentials) => Promise<void>;
  register: (payload: Registration) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sayfa yenilendiğinde kayıtlı token ile oturumu geri yükle.
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!tokenStorage.get()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (active) setUser(me);
      } catch {
        tokenStorage.clear();
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  // Herhangi bir istek 401 dönerse (ör. başka cihazdan çıkış yapıldı) oturumu kapat.
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async login(payload) {
        const result = await api.login(payload);
        tokenStorage.set(result.access_token);
        setUser(result.user);
      },
      async register(payload) {
        const result = await api.register(payload);
        tokenStorage.set(result.access_token);
        setUser(result.user);
      },
      async logout() {
        try {
          // Backend tüm cihazlardaki token'ları geçersiz kılar.
          await api.logout();
        } catch {
          /* Sunucuya ulaşılamasa da yerel oturum kapatılır. */
        } finally {
          tokenStorage.clear();
          setUser(null);
        }
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  }
  return context;
}

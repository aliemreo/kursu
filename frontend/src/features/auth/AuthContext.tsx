import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { tokenStorage } from '../../lib/tokenStorage';
import { api } from '../../services';
import type { LoginRequest, RegisterRequest, User } from '../../types/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async login(payload) {
        const response = await api.login(payload);
        tokenStorage.set(response.accessToken);
        setUser(response.user);
      },
      async register(payload) {
        const response = await api.register(payload);
        tokenStorage.set(response.accessToken);
        setUser(response.user);
      },
      logout() {
        tokenStorage.clear();
        setUser(null);
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
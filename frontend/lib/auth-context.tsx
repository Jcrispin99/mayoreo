import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAuthToken } from './api';

const TOKEN_STORAGE_KEY = 'mayoreo.auth.token';

type User = {
  id: number;
  name: string;
  email: string;
  permissions?: string[];
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        setAuthToken(storedToken);
        try {
          const response = await api.get('/me');
          setUser(response.data.data);
        } catch {
          await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
          setAuthToken(null);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async login(email: string, password: string) {
        const response = await api.post('/login', { email, password });
        const { token, user: loggedInUser } = response.data.data;
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
        setAuthToken(token);
        setUser(loggedInUser);
      },
      async logout() {
        try {
          await api.post('/logout');
        } catch {
          // token might already be invalid server-side; proceed with local logout regardless
        }
        await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
        setAuthToken(null);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  walletBalance: string | number;
  avatarUrl?: string | null;
  phone?: string | null;
  govtId?: string | null;
  verificationStatus?: string;
  is_admin?: boolean;
  wallet_balance?: string;
  avatar_url?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AUTH_TOKEN_KEY = "rankyatra_token";
const AUTH_USER_KEY = "rankyatra_user";

function normalizeUser(raw: any): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    isAdmin: raw.isAdmin ?? raw.is_admin ?? false,
    walletBalance: raw.walletBalance ?? raw.wallet_balance ?? 0,
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
    phone: raw.phone ?? null,
    govtId: raw.govtId ?? null,
    verificationStatus: raw.verificationStatus ?? "not_submitted",
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutRef = useRef<(() => Promise<void>) | null>(null);
  // Track if user is truly logged-in so 401 handler doesn't fire during startup or right after login
  const isLoggedInRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);
        if (storedToken && storedUser) {
          // Verify token with server before trusting it
          const res = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          }).catch(() => null);
          if (res && res.ok) {
            const freshUser = await res.json().catch(() => null);
            if (freshUser) {
              const normalized = normalizeUser(freshUser);
              await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalized));
              setToken(storedToken);
              setUser(normalized);
            } else {
              setToken(storedToken);
              setUser(normalizeUser(JSON.parse(storedUser)));
            }
          } else if (res && res.status === 401) {
            // Only clear token if server explicitly rejects it (401)
            // Don't clear on network errors, 5xx, or timeouts
            await Promise.all([
              AsyncStorage.removeItem(AUTH_TOKEN_KEY),
              AsyncStorage.removeItem(AUTH_USER_KEY),
            ]);
          } else {
            // Network issue or server error — keep token, let user stay logged in
            setToken(storedToken);
            setUser(normalizeUser(JSON.parse(storedUser)));
          }
        }
      } catch (_) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  // Keep isLoggedInRef in sync — with a small grace delay after login
  // so the 401 handler doesn't fire during the startup race condition
  useEffect(() => {
    if (user && token) {
      const timer = setTimeout(() => { isLoggedInRef.current = true; }, 500);
      return () => clearTimeout(timer);
    } else {
      isLoggedInRef.current = false;
    }
  }, [user, token]);

  // Register global 401 handler — auto-logout only when user is truly logged in
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (logoutRef.current && isLoggedInRef.current) logoutRef.current();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    const normalized = normalizeUser(newUser);
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalized)),
    ]);
    setToken(newToken);
    setUser(normalized);
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  // Keep ref in sync so the global 401 handler always calls the latest logout
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

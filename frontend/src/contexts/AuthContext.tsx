import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiRequest, ApiClientError, setToken } from "@/lib/api";

export type UserRole = "HOSPITAL_ADMIN" | "DOCTOR" | "GOVERNMENT_OFFICIAL";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hospital?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; role: UserRole; hospitalId?: string | null }) => Promise<void>;
  activate: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

type LoginResponse = { accessToken: string; user: User };
type VerifyResponse = { user: User };
type RegisterResponse = {
  user: { id: string; name: string; email: string; role: UserRole; isActive: boolean };
  activationEmailSent?: boolean;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem("holoid_access_token"));
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    if (!accessToken) {
      setUser(null);
      return;
    }
    const res = await apiRequest<VerifyResponse>("/auth/verify", { auth: true });
    setUser(res.data.user);
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      setAccessToken(res.data.accessToken);
      setToken(res.data.accessToken);
      setUser(res.data.user);
      return res.data.user;
    } catch (e) {
      // Ensure stale tokens don't cause confusing UI
      if (e instanceof ApiClientError && e.code === "UNAUTHENTICATED") {
        setAccessToken(null);
        setToken(null);
        setUser(null);
      }
      throw e;
    }
  };

  const register = async (data: { name: string; email: string; password: string; role: UserRole; hospitalId?: string | null }) => {
    await apiRequest<RegisterResponse>("/auth/register", {
      method: "POST",
      body: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        hospitalId: data.hospitalId || undefined,
      },
    });
  };

  const logout = async () => {
    try {
      await apiRequest<null>("/auth/logout", { method: "POST", auth: true });
    } catch {
      // Ignore network failures; clear local session anyway
    } finally {
      setAccessToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const activate = async (token: string) => {
    await apiRequest<null>(`/auth/activate?token=${encodeURIComponent(token)}`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (accessToken) await refreshSession();
      } catch {
        // If token is invalid/expired, clear it
        if (!cancelled) {
          setAccessToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      login,
      register,
      activate,
      logout,
      refreshSession,
      isAuthenticated: !!user && !!accessToken,
      isLoading,
    }),
    [user, accessToken, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

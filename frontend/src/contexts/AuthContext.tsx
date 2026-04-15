import React, { createContext, useContext, useState, ReactNode } from "react";

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
  login: (email: string, password: string) => void;
  register: (data: { name: string; email: string; password: string; role: UserRole; hospital?: string }) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USERS: Record<string, User> = {
  "admin@hospital.com": { id: "1", name: "Dr. A. Rajesh", email: "admin@hospital.com", role: "HOSPITAL_ADMIN", hospital: "City General Hospital" },
  "doctor@hospital.com": { id: "2", name: "Dr. S. Sharma", email: "doctor@hospital.com", role: "DOCTOR", hospital: "City General Hospital" },
  "gov@health.gov": { id: "3", name: "R. Menon", email: "gov@health.gov", role: "GOVERNMENT_OFFICIAL" },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (email: string, _password: string) => {
    const demoUser = DEMO_USERS[email];
    if (demoUser) {
      setUser(demoUser);
    } else {
      // Default to admin for demo
      setUser({ id: "99", name: "Demo User", email, role: "HOSPITAL_ADMIN", hospital: "Demo Hospital" });
    }
  };

  const register = (data: { name: string; email: string; role: UserRole; hospital?: string }) => {
    setUser({ id: "100", name: data.name, email: data.email, role: data.role, hospital: data.hospital });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

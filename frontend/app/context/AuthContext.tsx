"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { getApiUrl } from "@/app/lib/api";
import { messages } from "@/app/messages";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchCurrentUser(): Promise<User | null> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/v1/auth/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const userData = await response.json();
  return {
    id: userData.id,
    email: userData.email,
    name: userData.name,
  };
}

async function tryRefreshSession(): Promise<boolean> {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  return response.ok;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        let currentUser = await fetchCurrentUser();

        if (!currentUser) {
          const refreshed = await tryRefreshSession();
          if (refreshed) {
            currentUser = await fetchCurrentUser();
          }
        }

        setUser(currentUser);
      } catch (error) {
        console.error("Failed to restore auth session:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.loginFailed);
    }

    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      throw new Error(messages.auth.errors.loginFailed);
    }

    setUser(currentUser);
  };

  const loginWithGoogle = async (credential: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.googleLoginFailed);
    }

    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      throw new Error(messages.auth.errors.googleLoginFailed);
    }

    setUser(currentUser);
  };

  const register = async (name: string, email: string, password: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.registerFailed);
    }
  };

  const logout = async () => {
    const apiUrl = getApiUrl();
    await fetch(`${apiUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});

    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.forgotPasswordFailed);
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.resetPasswordFailed);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
        forgotPassword,
        resetPassword,
        isAuthenticated: !!user,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(messages.auth.errors.authProviderRequired);
  }
  return context;
}

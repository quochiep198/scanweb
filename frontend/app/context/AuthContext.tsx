"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { messages } from "@/app/messages";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredValue(key: string) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  } catch {}

  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}

  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function removeStoredValue(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}

  try {
    sessionStorage.removeItem(key);
  } catch {}
}

async function fetchCurrentUser(apiUrl: string, token: string): Promise<User | null> {
  const response = await fetch(`${apiUrl}/v1/protected`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  const userData = await response.json();
  return {
    id: userData.user_id,
    email: userData.email,
    name: userData.name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const apiUrl = getApiUrl();
      const storedAccessToken = readStoredValue(ACCESS_TOKEN_KEY);
      const storedRefreshToken = readStoredValue(REFRESH_TOKEN_KEY);
      const storedUser = readStoredValue(USER_KEY);

      if (!storedAccessToken) {
        setIsLoading(false);
        return;
      }

      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (err) {
          console.error("Error parsing stored user:", err);
        }
      }

      try {
        const currentUser = await fetchCurrentUser(apiUrl, storedAccessToken);
        if (currentUser) {
          setUser(currentUser);
          writeStoredValue(USER_KEY, JSON.stringify(currentUser));
          setIsLoading(false);
          return;
        }

        if (!storedRefreshToken) {
          throw new Error("Missing refresh token");
        }

        const refreshResponse = await fetch(`${apiUrl}/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: storedRefreshToken }),
        });

        if (!refreshResponse.ok) {
          throw new Error("Refresh token expired");
        }

        const refreshData = await refreshResponse.json();
        setAccessToken(refreshData.access_token);
        setRefreshToken(refreshData.refresh_token);
        writeStoredValue(ACCESS_TOKEN_KEY, refreshData.access_token);
        writeStoredValue(REFRESH_TOKEN_KEY, refreshData.refresh_token);

        const refreshedUser = await fetchCurrentUser(apiUrl, refreshData.access_token);
        if (refreshedUser) {
          setUser(refreshedUser);
          writeStoredValue(USER_KEY, JSON.stringify(refreshedUser));
        }
      } catch (error) {
        console.error("Failed to restore auth session:", error);
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        removeStoredValue(ACCESS_TOKEN_KEY);
        removeStoredValue(REFRESH_TOKEN_KEY);
        removeStoredValue(USER_KEY);
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
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.loginFailed);
    }

    const data = await response.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    writeStoredValue(ACCESS_TOKEN_KEY, data.access_token);
    writeStoredValue(REFRESH_TOKEN_KEY, data.refresh_token);

    try {
      const nextUser = await fetchCurrentUser(apiUrl, data.access_token);
      if (nextUser) {
        setUser(nextUser);
        writeStoredValue(USER_KEY, JSON.stringify(nextUser));
      } else {
        setUser(null);
        removeStoredValue(USER_KEY);
      }
    } catch (error) {
      console.error("Failed to fetch current user after login:", error);
      setUser(null);
      removeStoredValue(USER_KEY);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || messages.auth.errors.registerFailed);
    }
  };

  const logout = async () => {
    if (refreshToken) {
      const apiUrl = getApiUrl();
      await fetch(`${apiUrl}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    removeStoredValue(ACCESS_TOKEN_KEY);
    removeStoredValue(REFRESH_TOKEN_KEY);
    removeStoredValue(USER_KEY);
  };

  const forgotPassword = async (email: string) => {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        accessToken,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        isAuthenticated: !!accessToken,
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

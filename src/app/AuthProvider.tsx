import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { LoginPage } from "../components/LoginPage";

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: "ceo" | "admin" | "viewer";
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoggedIn: false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [checking, setChecking] = useState(true);

  // Verify token on mount
  useEffect(() => {
    if (!token) { setChecking(false); return; }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject("invalid")))
      .then((data) => {
        if (data.ok && data.user) {
          setUser(data.user);
          localStorage.setItem("auth_user", JSON.stringify(data.user));
        } else {
          handleLogout();
        }
      })
      .catch(() => {
        // Token invalid — clear and show login
        handleLogout();
      })
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = useCallback(() => {
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  }, [token]);

  const handleLogin = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    token,
    isLoggedIn: !!user && !!token,
    logout: handleLogout,
  }), [user, token, handleLogout]);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
        color: "rgba(255,255,255,0.5)",
        fontSize: 16,
        fontFamily: "'Inter', sans-serif",
      }}>
        🔄 กำลังตรวจสอบ...
      </div>
    );
  }

  if (!user || !token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

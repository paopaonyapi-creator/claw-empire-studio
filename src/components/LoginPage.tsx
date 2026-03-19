import React, { useState, useEffect, useRef } from "react";

interface LoginPageProps {
  onLogin: (token: string, user: { id: string; username: string; displayName: string; role: "ceo" | "admin" | "viewer" }) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Load Google Sign-In
  useEffect(() => {
    const clientId = (window as any).__GOOGLE_CLIENT_ID || "";
    if (!clientId) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).google?.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
      });
      if (googleBtnRef.current) {
        (window as any).google?.accounts.id.renderButton(googleBtnRef.current, {
          theme: "filled_blue",
          size: "large",
          width: 336,
          text: "signin_with",
          shape: "pill",
        });
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        onLogin(data.token, data.user);
      } else {
        setError(data.error || "Google login failed");
      }
    } catch {
      setError("Google login failed");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        onLogin(data.token, data.user);
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logoSection}>
          <div style={styles.logo}>🦞</div>
          <h1 style={styles.brandName}>Content Studio</h1>
          <p style={styles.brandSub}>Affiliate Marketing Command Center</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>👤 ชื่อผู้ใช้</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              style={styles.input}
              autoFocus
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>🔒 รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "🔄 กำลังเข้าสู่ระบบ..." : "🚀 เข้าสู่ระบบ"}
          </button>
        </form>

        {/* Google Sign-In */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>หรือ</span>
          <span style={styles.dividerLine} />
        </div>
        <div ref={googleBtnRef} style={styles.googleBtnWrapper} />

        <p style={styles.footer}>
          🔒 ติดต่อผู้ดูแลระบบหากลืมรหัสผ่าน
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
    fontFamily: "'Inter', 'Noto Sans Thai', sans-serif",
  },
  card: {
    width: "min(400px, 92vw)",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    borderRadius: 20,
    padding: "clamp(24px, 5vw, 40px) clamp(16px, 4vw, 32px)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
  },
  logoSection: { textAlign: "center", marginBottom: 32 },
  logo: {
    fontSize: "clamp(40px, 10vw, 56px)",
    display: "block",
    marginBottom: 12,
    animation: "pulse 2s infinite",
  },
  brandName: {
    margin: 0,
    fontSize: "clamp(22px, 6vw, 28px)",
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.5px",
  },
  brandSub: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  form: { display: "flex", flexDirection: "column", gap: 20 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
  },
  input: {
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
    fontSize: 15,
    color: "#fff",
    outline: "none",
    transition: "border-color 0.2s, background-color 0.2s",
  },
  error: {
    background: "rgba(239,68,68,0.15)",
    color: "#fca5a5",
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "center",
  },
  submitBtn: {
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #818cf8 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.2s",
    boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
  },
  footer: {
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    marginTop: 24,
    marginBottom: 0,
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "20px 0 16px",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "rgba(255,255,255,0.12)",
  },
  dividerText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: 500,
  },
  googleBtnWrapper: {
    display: "flex",
    justifyContent: "center",
  },
};

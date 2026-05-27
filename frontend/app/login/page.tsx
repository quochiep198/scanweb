"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";
import { useAuth } from "@/app/context/AuthContext";
import { messages } from "@/app/messages";
import { getApiUrl } from "@/app/lib/api";

const pageMessages = messages.auth.login;
const shared = messages.shared;

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [diagStatus, setDiagStatus] = useState("");
  const [diagChecking, setDiagChecking] = useState(false);

  const runDiagnostics = async () => {
    setDiagChecking(true);
    setDiagStatus("Đang kiểm tra kết nối...");
    try {
      alert("1. Khởi chạy chẩn đoán...");
      const apiUrl = getApiUrl();
      alert("2. API URL hiện tại: " + apiUrl);
      
      // Test localStorage
      let storageOk = false;
      try {
        localStorage.setItem("__diag_test__", "1");
        storageOk = localStorage.getItem("__diag_test__") === "1";
        localStorage.removeItem("__diag_test__");
      } catch (e) {
        alert("Lỗi kiểm tra localStorage: " + String(e));
        storageOk = false;
      }
      alert("3. Trạng thái LocalStorage: " + (storageOk ? "OK" : "Lỗi"));

      // Test cookie
      let cookieOk = false;
      try {
        document.cookie = "__diag_test__=1; path=/; max-age=10";
        cookieOk = document.cookie.includes("__diag_test__=1");
      } catch (e) {
        alert("Lỗi kiểm tra Cookie: " + String(e));
        cookieOk = false;
      }
      alert("4. Trạng thái Cookie: " + (cookieOk ? "OK" : "Lỗi"));

      // Test API Health
      alert("5. Bắt đầu gọi fetch tới " + `${apiUrl}/health`);
      let apiOk = "Không thể kết nối";
      let apiDetail = "";
      try {
        const res = await fetch(`${apiUrl}/health`, { mode: 'cors' });
        alert("6. Nhận phản hồi HTTP từ API: " + res.status);
        if (res.ok) {
          const data = await res.json();
          apiOk = `Thành công (HTTP ${res.status}, ${JSON.stringify(data)})`;
        } else {
          apiOk = `Lỗi HTTP ${res.status}`;
        }
      } catch (e: any) {
        alert("Lỗi fetch API: " + String(e));
        apiOk = `Thất bại`;
        apiDetail = e.message || String(e);
      }

      const result = `API URL: ${apiUrl}\n` +
        `LocalStorage: ${storageOk ? "Hoạt động" : "Bị chặn/Lỗi"}\n` +
        `Cookies: ${cookieOk ? "Hoạt động" : "Bị chặn/Lỗi"}\n` +
        `Kết nối API: ${apiOk}${apiDetail ? " (" + apiDetail + ")" : ""}`;

      setDiagStatus(result);
      alert("7. Kết quả chẩn đoán: \n" + result);
    } catch (err: any) {
      alert("Lỗi chẩn đoán tổng quát: " + String(err));
      setDiagStatus(`Lỗi chẩn đoán: ${err.message || err}`);
    } finally {
      setDiagChecking(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(messages.auth.errors.invalidEmail);
      return;
    }

    if (password.length < 8) {
      setError(messages.auth.errors.invalidPasswordLength);
      return;
    }

    setIsLoading(true);

    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.auth.errors.loginFailed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles["login-page"]}>
      <main className={styles["login-main"]}>
        <div className={styles["bg-decoration"]}>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwMSl9RVFU9if3vIslYiWgik0q4xTrBAslOxOYduUAhMGcURgTm_qa_HMxlSZkcHgQcIQnMkG9bP3WMWp-rrgqai1I8iSUNqebMx7q9o6FGaUL0VAPY1hbPOeFZO6mUdVevMIJxSDCu8x3ep30r4OBWJr1eknuGnzCPoeoTRzav0zJqvsHC-u1rzY1VJnEDtW0gH57yn4r-pQvP13w8-iHadd2tqXD4gWrr2QNODcfBO5PBCDVG5aDRufemScEvWm3XWMUTfmZqHIV"
            alt="Medical background"
          />
        </div>

        <div className={styles["login-content"]}>
          <div>
            <div className={styles["login-brand"]}>
              <div className={styles["brand-logo"]}>
                <span className="material-symbols-outlined">health_metrics</span>
              </div>
              <div className={styles["brand-text"]}>
                <h1>{messages.brand.name}</h1>
                <p>{messages.brand.tagline}</p>
              </div>
            </div>

            <div className={styles["form-card"]}>
              <header className={styles["form-header"]}>
                <h2>{pageMessages.title}</h2>
                <p>{pageMessages.description}</p>
              </header>

              {error && <div className={`${styles.alert} ${styles["alert-error"]}`}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className={styles["input-group"]}>
                  <label>{pageMessages.emailLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">person</span>
                    </span>
                    <input
                      type="text"
                      className={styles["form-input"]}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nguyen.van.a@clinic.vn"
                      required
                    />
                  </div>
                </div>

                <div className={styles["input-group"]}>
                  <label>{pageMessages.passwordLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">lock</span>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`${styles["form-input"]} ${styles["password-input"]}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={pageMessages.passwordPlaceholder}
                      required
                    />
                    <button
                      type="button"
                      className={styles["password-toggle"]}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? pageMessages.hidePassword : pageMessages.showPassword}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className={styles["options-row"]}>
                  <label className={styles["checkbox-wrapper"]}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>{pageMessages.rememberMe}</span>
                  </label>
                  <div className={styles["options-links"]}>
                    <Link href="/register" className={styles["footer-link"]}>
                      {pageMessages.registerLink}
                    </Link>
                    <span className={styles["links-divider"]}>|</span>
                    <Link href="/forgot-password" className={styles["footer-link"]}>
                      {pageMessages.forgotPassword}
                    </Link>
                  </div>
                </div>

                <button type="submit" className={styles["btn-primary"]} disabled={isLoading}>
                  <span>{isLoading ? pageMessages.submitting : pageMessages.submit}</span>
                  <span className="material-symbols-outlined">login</span>
                </button>

                <div className={styles["register-prompt"]}>
                  <span>{pageMessages.registerPrompt}</span>
                  <Link href="/register" className={styles["footer-link"]}>
                    {pageMessages.registerLink}
                  </Link>
                </div>
              </form>

              <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', background: '#f8fafc', color: '#334155' }}>
                <h4 style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                  <span>Chẩn đoán hệ thống (System Diagnostics)</span>
                  <button 
                    type="button" 
                    onClick={runDiagnostics} 
                    disabled={diagChecking}
                    style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer', background: '#0052CC', color: '#fff', border: 'none', borderRadius: '4px' }}
                  >
                    {diagChecking ? "Đang chạy..." : "Kiểm tra"}
                  </button>
                </h4>
                {diagStatus ? (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', background: '#f1f5f9', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    {diagStatus}
                  </pre>
                ) : (
                  <p style={{ margin: 0, color: '#64748b' }}>Nhấn nút "Kiểm tra" để chẩn đoán kết nối API và bộ nhớ.</p>
                )}
              </div>

              <div className={styles["trust-bar"]}>
                <div className={styles["trust-item"]}>
                  <span className="material-symbols-outlined">verified_user</span>
                  <span>HIPAA Compliant</span>
                </div>
                <div className={styles["trust-item"]}>
                  <span className="material-symbols-outlined">shield</span>
                  <span>SSL Secure</span>
                </div>
                <div className={styles["trust-item"]}>
                  <span className="material-symbols-outlined">lock_person</span>
                  <span>256-bit AES</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles["login-visual"]}>
            <div className={styles["visual-content"]}>
              <h3>{shared.heroTitle}</h3>
              <p>{shared.heroDescription}</p>

              <div className={`${styles["feature-card"]} ${styles["primary"]}`}>
                <div className={`${styles["feature-icon"]} ${styles["primary"]}`}>
                  <span className="material-symbols-outlined">speed</span>
                </div>
                <div className={styles["feature-text"]}>
                  <h4>{shared.featureSpeedTitle}</h4>
                  <p>{shared.featureSpeedDescription}</p>
                </div>
              </div>

              <div className={`${styles["feature-card"]} ${styles["default"]}`}>
                <div className={`${styles["feature-icon"]} ${styles["default"]}`}>
                  <span className="material-symbols-outlined">analytics</span>
                </div>
                <div className={`${styles["feature-text"]} ${styles["default"]}`}>
                  <h4>{shared.featureReportTitle}</h4>
                  <p>{shared.featureReportDescription}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className={styles["login-footer"]}>
        <div className={styles["footer-copyright"]}>
          Ban quyen 2024 <strong>{messages.brand.name}</strong>. All rights reserved.
        </div>
        <div className={styles["footer-links"]}>
          <a href="#">
            <span className="material-symbols-outlined">support_agent</span>
            {shared.support}
          </a>
          <a href="#">
            <span className="material-symbols-outlined">policy</span>
            {shared.privacy}
          </a>
          <div className={styles["footer-links-divider"]}></div>
          <div className={styles["status-indicator"]}>
            <div className={styles["status-dot"]}></div>
            <span className={styles["status-text"]}>{shared.systemActive}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";
import { useAuth } from "@/app/context/AuthContext";
import { messages } from "@/app/messages";

const pageMessages = messages.auth.login;
const shared = messages.shared;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      router.push("/dashboard");
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
                  <Link href="/forgot-password" className={styles["footer-link"]}>
                    {pageMessages.forgotPassword}
                  </Link>
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

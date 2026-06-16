"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";

import styles from "@/app/auth/auth.module.css";
import { useAuth } from "@/app/context/AuthContext";
import { messages } from "@/app/messages";

const pageMessages = messages.auth.login;
const shared = messages.shared;

export default function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const initGoogleSignIn = () => {
    const google = (window as any).google;
    const btn = document.getElementById("google-signin-btn");
    if (google && google.accounts && btn) {
      google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        callback: handleGoogleCredential,
      });

      google.accounts.id.renderButton(
        btn,
        {
          theme: "outline",
          size: "large",
          width: "360",
          text: "signin_with",
          shape: "rectangular",
        }
      );
    }
  };

  const handleGoogleCredential = async (response: any) => {
    setIsLoading(true);
    setError("");
    try {
      await loginWithGoogle(response.credential);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.auth.errors.googleLoginFailed);
    } finally {
      setIsLoading(false);
    }
  };

  // Restore remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Google sign in initialization & fallback check
  useEffect(() => {
    if ((window as any).google) {
      initGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google) {
          initGoogleSignIn();
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setEmailError("");
    setPasswordError("");

    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError(messages.auth.errors.invalidEmail);
      hasError = true;
    }

    if (password.length < 8) {
      setPasswordError(messages.auth.errors.invalidPasswordLength);
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      await login(email.trim().toLowerCase(), password, rememberMe);
      if (rememberMe) {
        localStorage.setItem("remembered_email", email.trim());
      } else {
        localStorage.removeItem("remembered_email");
      }
      router.replace("/");
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
                  <label htmlFor="email-input">{pageMessages.emailLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">person</span>
                    </span>
                    <input
                      id="email-input"
                      type="email"
                      className={`${styles["form-input"]} ${emailError ? styles["input-error"] : ""}`}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError("");
                      }}
                      placeholder="nguyen.van.a@clinic.vn"
                      required
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect="off"
                      spellCheck="false"
                    />
                  </div>
                  {emailError && <span className={styles["field-error"]}>{emailError}</span>}
                </div>

                <div className={styles["input-group"]}>
                  <label htmlFor="password-input">{pageMessages.passwordLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">lock</span>
                    </span>
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      className={`${styles["form-input"]} ${styles["password-input"]} ${passwordError ? styles["input-error"] : ""}`}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      placeholder={pageMessages.passwordPlaceholder}
                      required
                      autoComplete="current-password"
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
                  {passwordError && <span className={styles["field-error"]}>{passwordError}</span>}
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
                    <span className={styles["links-divider"]}>|</span>
                    <Link href="/forgot-password" className={styles["footer-link"]}>
                      {pageMessages.forgotPassword}
                    </Link>
                  </div>
                </div>

                <button type="submit" className={styles["btn-primary"]} disabled={isLoading}>
                  <span>{isLoading ? pageMessages.submitting : pageMessages.submit}</span>
                  {isLoading ? (
                    <span className={styles["loading-spinner-btn"]}></span>
                  ) : (
                    <span className="material-symbols-outlined">login</span>
                  )}
                </button>

                <div className={styles["auth-divider"]}>{pageMessages.orSignInWith}</div>

                <div className={styles["google-btn-container"]}>
                  <div id="google-signin-btn"></div>
                </div>

                <Script
                  src="https://accounts.google.com/gsi/client"
                  onReady={initGoogleSignIn}
                  strategy="lazyOnload"
                />

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
                  <span>{pageMessages.trustPrivate}</span>
                </div>
                <div className={styles["trust-item"]}>
                  <span className="material-symbols-outlined">shield</span>
                  <span>{pageMessages.trustSecure}</span>
                </div>
                <div className={styles["trust-item"]}>
                  <span className="material-symbols-outlined">lock_person</span>
                  <span>{pageMessages.trustEncrypted}</span>
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
            </div>
          </div>
        </div>
      </main>

      <footer className={styles["login-footer"]}>
        <div className={styles["footer-copyright"]}>
          {pageMessages.copyright} <strong>{messages.brand.name}</strong>. All rights reserved.
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

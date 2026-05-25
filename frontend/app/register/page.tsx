"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";
import { useAuth } from "@/app/context/AuthContext";
import { messages } from "@/app/messages";

const pageMessages = messages.auth.register;
const shared = messages.shared;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (value: string): string => {
    if (value.length < 8) return messages.auth.errors.invalidPasswordLength;
    if (!/[A-Z]/.test(value)) return messages.auth.errors.invalidPasswordUpper;
    if (!/[a-z]/.test(value)) return messages.auth.errors.invalidPasswordLower;
    if (!/[0-9]/.test(value)) return messages.auth.errors.invalidPasswordDigit;
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError(pageMessages.nameTooShort);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(messages.auth.errors.invalidEmail);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError(messages.auth.errors.passwordMismatch);
      return;
    }

    setIsLoading(true);

    try {
      await register(name.trim(), email.trim(), password);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.auth.errors.registerFailed);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles["login-page"]}>
        <main className={styles["login-main"]}>
          <div className={styles["bg-decoration"]}>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwMSl9RVFU9if3vIslYiWgik0q4xTrBAslOxOYduUAhMGcURgTm_qa_HMxlSZkcHgQcIQnMkG9bP3WMWp-rrgqai1I8iSUNqebMx7q9o6FGaUL0VAPY1hbPOeFZO6mUdVevMIJxSDCu8x3ep30r4OBWJr1eknuGnzCPoeoTRzav0zJqvsHC-u1rzY1VJnEDtW0gH57yn4r-pQvP13w8-iHadd2tqXD4gWrr2QNODcfBO5PBCDVG5aDRufemScEvWm3XWMUTfmZqHIV"
              alt=""
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
                <div style={{ textAlign: "center" }}>
                  <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                      check_circle
                    </span>
                  </div>
                  <h2 className={styles["form-header"]} style={{ textAlign: "center" }}>
                    {pageMessages.successTitle}
                  </h2>
                  <p
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "14px",
                      color: "#434654",
                      marginBottom: "24px",
                    }}
                  >
                    {pageMessages.successDescription}
                  </p>
                  <div className={`${styles.alert} ${styles["alert-success"]}`}>
                    {pageMessages.redirecting}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles["login-visual"]}>
              <div className={styles["visual-content"]}>
                <h3>{shared.heroTitle}</h3>
                <p>{shared.heroDescription}</p>
              </div>
            </div>
          </div>
        </main>
        <footer className={styles["login-footer"]}>
          <div className={styles["footer-copyright"]}>
            Ban quyen 2024 <strong>{messages.brand.name}</strong>. All rights reserved.
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className={styles["login-page"]}>
      <main className={styles["login-main"]}>
        <div className={styles["bg-decoration"]}>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwMSl9RVFU9if3vIslYiWgik0q4xTrBAslOxOYduUAhMGcURgTm_qa_HMxlSZkcHgQcIQnMkG9bP3WMWp-rrgqai1I8iSUNqebMx7q9o6FGaUL0VAPY1hbPOeFZO6mUdVevMIJxSDCu8x3ep30r4OBWJr1eknuGnzCPoeoTRzav0zJqvsHC-u1rzY1VJnEDtW0gH57yn4r-pQvP13w8-iHadd2tqXD4gWrr2QNODcfBO5PBCDVG5aDRufemScEvWm3XWMUTfmZqHIV"
            alt=""
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
                  <label>{pageMessages.nameLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">person</span>
                    </span>
                    <input
                      type="text"
                      className={styles["form-input"]}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={pageMessages.namePlaceholder}
                      required
                    />
                  </div>
                </div>

                <div className={styles["input-group"]}>
                  <label>{pageMessages.emailLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">mail</span>
                    </span>
                    <input
                      type="email"
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
                      type="password"
                      className={`${styles["form-input"]} ${styles["password-input"]}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={pageMessages.passwordPlaceholder}
                      required
                    />
                  </div>
                </div>

                <div className={styles["input-group"]}>
                  <label>{pageMessages.confirmPasswordLabel}</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">lock</span>
                    </span>
                    <input
                      type="password"
                      className={`${styles["form-input"]} ${styles["password-input"]}`}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={pageMessages.confirmPasswordPlaceholder}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className={styles["btn-primary"]} disabled={isLoading}>
                  {isLoading ? pageMessages.submitting : pageMessages.submit}
                </button>
              </form>

              <div className={styles["options-row"]} style={{ justifyContent: "center", marginTop: "16px" }}>
                <Link href="/login" className={styles["footer-link"]}>
                  {shared.loginLink}
                </Link>
              </div>
            </div>
          </div>
          <div className={styles["login-visual"]}>
            <div className={styles["visual-content"]}>
              <h3>{shared.heroTitle}</h3>
              <p>{shared.heroDescription}</p>
            </div>
          </div>
        </div>
      </main>
      <footer className={styles["login-footer"]}>
        <div className={styles["footer-copyright"]}>
          Ban quyen 2024 <strong>{messages.brand.name}</strong>. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

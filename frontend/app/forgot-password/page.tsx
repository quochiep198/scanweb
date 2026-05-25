"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";
import { useAuth } from "@/app/context/AuthContext";
import { messages } from "@/app/messages";

type Step = "email" | "otp" | "success";

const pageMessages = messages.auth.forgotPassword;
const shared = messages.shared;

export default function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const validatePassword = (value: string): string => {
    if (value.length < 8) return messages.auth.errors.invalidPasswordLength;
    if (!/[A-Z]/.test(value)) return messages.auth.errors.invalidPasswordUpper;
    if (!/[a-z]/.test(value)) return messages.auth.errors.invalidPasswordLower;
    if (!/[0-9]/.test(value)) return messages.auth.errors.invalidPasswordDigit;
    return "";
  };

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(messages.auth.errors.invalidEmail);
      return;
    }

    setIsLoading(true);

    try {
      await forgotPassword(email.trim());
      setStep("otp");
      setSuccessMessage(pageMessages.otpSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.auth.errors.forgotPasswordFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setError(messages.auth.errors.invalidOtp);
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(messages.auth.errors.passwordMismatch);
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(email.trim(), otp, newPassword);
      setStep("success");
      setSuccessMessage(pageMessages.successTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.auth.errors.resetPasswordFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      await forgotPassword(email.trim());
      setSuccessMessage(pageMessages.resendSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.auth.errors.resendOtpFailed);
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success") {
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
                      fontWeight: "400",
                      color: "#434654",
                      lineHeight: "20px",
                      marginBottom: "24px",
                    }}
                  >
                    {pageMessages.successDescription}
                  </p>
                  <button
                    type="button"
                    className={styles["btn-primary"]}
                    onClick={() => router.push("/login")}
                  >
                    {pageMessages.successButton}
                  </button>
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
          <div className={styles["footer-links"]}>
            <Link href="/login" className={styles["footer-link"]}>
              {shared.loginLink}
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  if (step === "otp") {
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
                  <h2>{pageMessages.otpStepTitle}</h2>
                  <p>{pageMessages.otpStepDescription(email)}</p>
                </header>

                {(error || successMessage) && (
                  <div className={`${styles.alert} ${error ? styles["alert-error"] : styles["alert-success"]}`}>
                    {error || successMessage}
                  </div>
                )}

                <form onSubmit={handleResetPassword}>
                  <div className={styles["input-group"]}>
                    <label>{pageMessages.otpLabel}</label>
                    <div className={styles["input-wrapper"]}>
                      <span className={styles["input-icon"]}>
                        <span className="material-symbols-outlined">pin</span>
                      </span>
                      <input
                        type="text"
                        className={styles["form-input"]}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder={pageMessages.otpPlaceholder}
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles["input-group"]}>
                    <label>{pageMessages.newPasswordLabel}</label>
                    <div className={styles["input-wrapper"]}>
                      <span className={styles["input-icon"]}>
                        <span className="material-symbols-outlined">lock</span>
                      </span>
                      <input
                        type="password"
                        className={`${styles["form-input"]} ${styles["password-input"]}`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
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
                    {isLoading ? pageMessages.resetSubmitting : pageMessages.resetSubmit}
                  </button>
                </form>

                <div className={styles["options-row"]} style={{ justifyContent: "center", marginTop: "16px" }}>
                  <button
                    type="button"
                    className={styles["footer-link"]}
                    onClick={handleResendOtp}
                    disabled={isLoading}
                  >
                    {pageMessages.resendOtp}
                  </button>
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
          <div className={styles["footer-links"]}>
            <Link href="/login" className={styles["footer-link"]}>
              {shared.loginLink}
            </Link>
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
              {successMessage && (
                <div className={`${styles.alert} ${styles["alert-success"]}`}>{successMessage}</div>
              )}

              <form onSubmit={handleSendOtp}>
                <div className={styles["input-group"]}>
                  <label>Email</label>
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

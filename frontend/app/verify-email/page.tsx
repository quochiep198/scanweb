"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/app/auth/auth.module.css";
import { messages } from "@/app/messages";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const pageMessages = messages.auth.verifyEmail;
const shared = messages.shared;

function VerifyEmailContent() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>(pageMessages.loadingMessage);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage(messages.auth.errors.invalidVerifyToken);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/v1/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || pageMessages.successMessage);
          return;
        }

        setStatus("error");
        setMessage(data.detail || messages.auth.errors.verifyFailed);
      } catch {
        setStatus("error");
        setMessage(messages.auth.errors.serverUnavailable);
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div style={{ textAlign: "center" }}>
      {status === "loading" && (
        <>
          <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              progress_activity
            </span>
          </div>
          <h2 className={styles["form-header"]}>{pageMessages.loadingTitle}</h2>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: "#434654",
              marginBottom: "24px",
            }}
          >
            {shared.loading}
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <div
            className={styles["brand-logo"]}
            style={{ margin: "0 auto 16px", background: "#22c55e" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              check
            </span>
          </div>
          <h2 className={styles["form-header"]} style={{ color: "#22c55e" }}>
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
            {message}
          </p>
          <button
            type="button"
            className={styles["btn-primary"]}
            onClick={() => router.push("/login")}
          >
            {shared.loginNow}
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <div
            className={styles["brand-logo"]}
            style={{ margin: "0 auto 16px", background: "#ba1a1a" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              close
            </span>
          </div>
          <h2 className={styles["form-header"]} style={{ color: "#ba1a1a" }}>
            {pageMessages.errorTitle}
          </h2>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: "#434654",
              marginBottom: "24px",
            }}
          >
            {message}
          </p>
          <button
            type="button"
            className={styles["btn-primary"]}
            onClick={() => router.push("/login")}
          >
            {shared.loginLink}
          </button>
        </>
      )}
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div style={{ textAlign: "center" }}>
      <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px" }}>
        <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
          progress_activity
        </span>
      </div>
      <h2 className={styles["form-header"]}>{pageMessages.loadingTitle}</h2>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          color: "#434654",
          marginBottom: "24px",
        }}
      >
        {shared.loading}
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
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
              <Suspense fallback={<VerifyEmailFallback />}>
                <VerifyEmailContent />
              </Suspense>
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

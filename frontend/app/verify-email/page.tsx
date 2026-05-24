"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang xác thực email...");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Token xác thực không hợp lệ");
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:8000/v1/auth/verify-email?token=${token}`
        );

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Xác thực email thành công!");
        } else {
          setStatus("error");
          setMessage(data.detail || "Xác thực thất bại");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Không thể kết nối đến server");
      }
    };

    verifyEmail();
  }, [searchParams]);

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
                <h1>OsteoScan DXA</h1>
                <p>Diagnostic Excellence</p>
              </div>
            </div>
            <div className={styles["form-card"]}>
              <div style={{ textAlign: "center" }}>
                {status === "loading" && (
                  <>
                    <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                        progress_activity
                      </span>
                    </div>
                    <h2 className={styles["form-header"]}>Đang xác thực...</h2>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#434654", marginBottom: "24px" }}>
                      Vui lòng chờ trong giây lát
                    </p>
                  </>
                )}

                {status === "success" && (
                  <>
                    <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px", background: "#22c55e" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                        check
                      </span>
                    </div>
                    <h2 className={styles["form-header"]} style={{ color: "#22c55e" }}>
                      Xác thực thành công!
                    </h2>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#434654", marginBottom: "24px" }}>
                      {message}
                    </p>
                    <button
                      type="button"
                      className={styles["btn-primary"]}
                      onClick={() => router.push("/login")}
                    >
                      Đăng nhập ngay
                    </button>
                  </>
                )}

                {status === "error" && (
                  <>
                    <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px", background: "#ba1a1a" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                        close
                      </span>
                    </div>
                    <h2 className={styles["form-header"]} style={{ color: "#ba1a1a" }}>
                      Xác thực thất bại
                    </h2>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#434654", marginBottom: "24px" }}>
                      {message}
                    </p>
                    <button
                      type="button"
                      className={styles["btn-primary"]}
                      onClick={() => router.push("/login")}
                    >
                      Quay lại đăng nhập
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className={styles["login-visual"]}>
            <div className={styles["visual-content"]}>
              <h3>Phân tích mật độ xương thế hệ mới.</h3>
              <p>
                OsteoScan DXA cung cấp độ chính xác tối ưu trong chẩn đoán loãng xương và đánh giá rủi ro gãy xương cho bệnh nhân.
              </p>
            </div>
          </div>
        </div>
      </main>
      <footer className={styles["login-footer"]}>
        <div className={styles["footer-copyright"]}>
          Bản quyền © 2024 <strong>OsteoScan DXA</strong>. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
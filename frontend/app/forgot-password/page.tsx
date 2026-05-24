"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";

type Step = "email" | "otp" | "success";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const router = useRouter();

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!/[A-Z]/.test(pwd)) return "Mật khẩu phải có ít nhất 1 chữ hoa";
    if (!/[a-z]/.test(pwd)) return "Mật khẩu phải có ít nhất 1 chữ thường";
    if (!/[0-9]/.test(pwd)) return "Mật khẩu phải có ít nhất 1 số";
    return "";
  };

  const handleSendOtp = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email không hợp lệ");
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep("otp");
      setSuccessMessage("Mã OTP đã được gửi đến email của bạn");
    } catch (err) {
      setError("Gửi yêu cầu thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setError("");

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setError("Mã OTP phải là 6 chữ số");
      return;
    }

    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep("success");
      setSuccessMessage("Đặt lại mật khẩu thành công!");
    } catch (err) {
      setError("Đặt lại mật khẩu thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccessMessage("Đã gửi lại mã OTP");
    } catch (err) {
      setError("Gửi lại mã OTP thất bại");
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
                  <h1>OsteoScan DXA</h1>
                  <p>Diagnostic Excellence</p>
                </div>
              </div>
              <div className={styles["form-card"]}>
                <div style={{ textAlign: "center" }}>
                  <div className={styles["brand-logo"]} style={{ margin: "0 auto 16px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>check_circle</span>
                  </div>
                  <h2 className={styles["form-header"]} style={{ textAlign: "center" }}>Đặt lại mật khẩu thành công!</h2>
                  <p className="font-body-sm text-on-surface-variant" style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", fontWeight: "400", color: "#434654", lineHeight: "20px", marginBottom: "24px" }}>
                    Bạn có thể đăng nhập với mật khẩu mới.
                  </p>
                  <button
                    type="button"
                    className={styles["btn-primary"]}
                    onClick={() => router.push("/login")}
                  >
                    Đăng nhập
                  </button>
                </div>
              </div>
            </div>
            <div className={styles["login-visual"]}>
              <div className={styles["visual-content"]}>
                <h3>Phân tích mật độ xương thế hệ mới.</h3>
                <p>
                  OsteoScan DXA cung cấp độ chính xác tối ưu trong chẩn đoán loãng xương và đánh giá rủi ro gãy xương cho bệnh nhân.
                </p>
                <div className={`${styles["feature-card"]} ${styles["primary"]}`}>
                  <div className={`${styles["feature-icon"]} ${styles["primary"]}`}>
                    <span className="material-symbols-outlined">speed</span>
                  </div>
                  <div className={styles["feature-text"]}>
                    <h4>Xử lý thời gian thực</h4>
                    <p>Kết quả phân tích có ngay sau khi quét với sai số tối thiểu.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <footer className={styles["login-footer"]}>
          <div className={styles["footer-copyright"]}>
            Bản quyền © 2024 <strong>OsteoScan DXA</strong>. All rights reserved.
          </div>
          <div className={styles["footer-links"]}>
            <Link href="/login" className={styles["footer-link"]}>
              Quay lại đăng nhập
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
                  <h1>OsteoScan DXA</h1>
                  <p>Diagnostic Excellence</p>
                </div>
              </div>
              <div className={styles["form-card"]}>
                <header className={styles["form-header"]}>
                  <h2>Đặt lại mật khẩu</h2>
                  <p>Mã OTP đã được gửi đến {email}</p>
                </header>

                {(error || successMessage) && (
                  <div className={`${styles.alert} ${error ? styles["alert-error"] : styles["alert-success"]}`}>
                    {error || successMessage}
                  </div>
                )}

                <form onSubmit={handleResetPassword}>
                  <div className={styles["input-group"]}>
                    <label>Mã OTP</label>
                    <div className={styles["input-wrapper"]}>
                      <span className={styles["input-icon"]}>
                        <span className="material-symbols-outlined">pin</span>
                      </span>
                      <input
                        type="text"
                        className={styles["form-input"]}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6 chữ số"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>

                  <div className={styles["input-group"]}>
                    <label>Mật khẩu mới</label>
                    <div className={styles["input-wrapper"]}>
                      <span className={styles["input-icon"]}>
                        <span className="material-symbols-outlined">lock</span>
                      </span>
                      <input
                        type="password"
                        className={`${styles["form-input"]} ${styles["password-input"]}`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ít nhất 8 ký tự, 1 chữ hoa, 1 số"
                        required
                      />
                    </div>
                  </div>

                  <div className={styles["input-group"]}>
                    <label>Xác nhận mật khẩu mới</label>
                    <div className={styles["input-wrapper"]}>
                      <span className={styles["input-icon"]}>
                        <span className="material-symbols-outlined">lock</span>
                      </span>
                      <input
                        type="password"
                        className={`${styles["form-input"]} ${styles["password-input"]}`}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className={styles["btn-primary"]} disabled={isLoading}>
                    {isLoading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                  </button>
                </form>

                <div className={styles["options-row"]} style={{ justifyContent: "center", marginTop: "16px" }}>
                  <button
                    type="button"
                    className={styles["footer-link"]}
                    onClick={handleResendOtp}
                    disabled={isLoading}
                  >
                    Gửi lại mã OTP
                  </button>
                </div>
              </div>
            </div>
            <div className={styles["login-visual"]}>
              <div className={styles["visual-content"]}>
                <h3>Phân tích mật độ xương thế hệ mới.</h3>
                <p>
                  OsteoScan DXA cung cấp độ chính xác tối ưu trong chẩn đoán loãng xương và đánh giá rủi ro gãy xương cho bệnh nhân.
                </p>
                <div className={`${styles["feature-card"]} ${styles["primary"]}`}>
                  <div className={`${styles["feature-icon"]} ${styles["primary"]}`}>
                    <span className="material-symbols-outlined">speed</span>
                  </div>
                  <div className={styles["feature-text"]}>
                    <h4>Xử lý thời gian thực</h4>
                    <p>Kết quả phân tích có ngay sau khi quét với sai số tối thiểu.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
        <footer className={styles["login-footer"]}>
          <div className={styles["footer-copyright"]}>
            Bản quyền © 2024 <strong>OsteoScan DXA</strong>. All rights reserved.
          </div>
          <div className={styles["footer-links"]}>
            <Link href="/login" className={styles["footer-link"]}>
              ← Quay lại đăng nhập
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
                <h1>OsteoScan DXA</h1>
                <p>Diagnostic Excellence</p>
              </div>
            </div>
            <div className={styles["form-card"]}>
              <header className={styles["form-header"]}>
                <h2>Quên mật khẩu</h2>
                <p>Nhập email đã đăng ký để nhận mã OTP</p>
              </header>

              {error && (
                <div className={`${styles.alert} ${styles["alert-error"]}`}>
                  {error}
                </div>
              )}
              {successMessage && (
                <div className={`${styles.alert} ${styles["alert-success"]}`}>
                  {successMessage}
                </div>
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
                  {isLoading ? "Đang gửi..." : "Gửi mã OTP"}
                </button>
              </form>

              <div className={styles["options-row"]} style={{ justifyContent: "center", marginTop: "16px" }}>
                <Link href="/login" className={styles["footer-link"]}>
                  ← Quay lại đăng nhập
                </Link>
              </div>
            </div>
          </div>
          <div className={styles["login-visual"]}>
            <div className={styles["visual-content"]}>
              <h3>Phân tích mật độ xương thế hệ mới.</h3>
              <p>
                OsteoScan DXA cung cấp độ chính xác tối ưu trong chẩn đoán loãng xương và đánh giá rủi ro gãy xương cho bệnh nhân.
              </p>
              <div className={`${styles["feature-card"]} ${styles["primary"]}`}>
                <div className={`${styles["feature-icon"]} ${styles["primary"]}`}>
                  <span className="material-symbols-outlined">speed</span>
                </div>
                <div className={styles["feature-text"]}>
                  <h4>Xử lý thời gian thực</h4>
                  <p>Kết quả phân tích có ngay sau khi quét với sai số tối thiểu.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className={styles["login-footer"]}>
        <div className={styles["footer-copyright"]}>
          Bản quyền © 2024 <strong>OsteoScan DXA</strong>. All rights reserved.
        </div>
        <div className={styles["footer-links"]}>
          <a href="#">
            <span className="material-symbols-outlined">support_agent</span>
            Hỗ trợ
          </a>
          <a href="#">
            <span className="material-symbols-outlined">policy</span>
            Chính sách bảo mật
          </a>
          <div className={styles["status-indicator"]}>
            <div className={styles["status-dot"]}></div>
            <span className={styles["status-text"]}>Hệ thống đang hoạt động</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
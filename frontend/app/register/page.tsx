"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const validatePassword = (pwd: string): string => {
    if (pwd.length < 8) return "Mật khẩu phải có ít nhất 8 ký tự";
    if (!/[A-Z]/.test(pwd)) return "Mật khẩu phải có ít nhất 1 chữ hoa";
    if (!/[a-z]/.test(pwd)) return "Mật khẩu phải có ít nhất 1 chữ thường";
    if (!/[0-9]/.test(pwd)) return "Mật khẩu phải có ít nhất 1 số";
    return "";
  };

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Họ tên phải có ít nhất 2 ký tự");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email không hợp lệ");
      return;
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError("Đăng ký thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles["login-page"]}>
        <main className={styles["login-main"]}>
          <div className={styles["bg-decoration"]}>
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwMSl9RVFU9if3vIslYiWgik0q4xTrBAslOxOYduUAhMGcURgTm_qa_HMxlSZkcHgQcIQnMkG9bP3WMWp-rrgqai1I8iSUNqebMx7q9o6FGaUL0VAPY1hbPOeFZO6mUdVevMIJxSDCu8x3ep30r4OBWJr1eknuGnzCPoeoTRzav0zJqvsHC-u1rzY1VJnEDtW0gH57yn4r-pQvP13w8-iHadd2tqXD4gWrr2QNODcfBO5PBCDVG5aDRufemScEvWm3XWMUTfmZqHIV" alt="" />
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
                  <h2 className={styles["form-header"]} style={{ textAlign: "center" }}>Đăng ký thành công!</h2>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#434654", marginBottom: "24px" }}>
                    Vui lòng kiểm tra email để xác thực tài khoản.
                  </p>
                  <div className={`${styles.alert} ${styles["alert-success"]}`}>
                    Đang chuyển hướng đến trang đăng nhập...
                  </div>
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

  return (
    <div className={styles["login-page"]}>
      <main className={styles["login-main"]}>
        <div className={styles["bg-decoration"]}>
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwMSl9RVFU9if3vIslYiWgik0q4xTrBAslOxOYduUAhMGcURgTm_qa_HMxlSZkcHgQcIQnMkG9bP3WMWp-rrgqai1I8iSUNqebMx7q9o6FGaUL0VAPY1hbPOeFZO6mUdVevMIJxSDCu8x3ep30r4OBWJr1eknuGnzCPoeoTRzav0zJqvsHC-u1rzY1VJnEDtW0gH57yn4r-pQvP13w8-iHadd2tqXD4gWrr2QNODcfBO5PBCDVG5aDRufemScEvWm3XWMUTfmZqHIV" alt="" />
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
                <h2>Đăng ký</h2>
                <p>Tạo tài khoản mới để truy cập hệ thống</p>
              </header>

              {error && (
                <div className={`${styles.alert} ${styles["alert-error"]}`}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className={styles["input-group"]}>
                  <label>Họ tên</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">person</span>
                    </span>
                    <input
                      type="text"
                      className={styles["form-input"]}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>
                </div>

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

                <div className={styles["input-group"]}>
                  <label>Mật khẩu</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">lock</span>
                    </span>
                    <input
                      type="password"
                      className={`${styles["form-input"]} ${styles["password-input"]}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ít nhất 8 ký tự, 1 chữ hoa, 1 số"
                      required
                    />
                  </div>
                </div>

                <div className={styles["input-group"]}>
                  <label>Xác nhận mật khẩu</label>
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
                  {isLoading ? "Đang đăng ký..." : "Đăng ký"}
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
              <div className={`${styles["feature-card"]} ${styles["default"]}`}>
                <div className={`${styles["feature-icon"]} ${styles["default"]}`}>
                  <span className="material-symbols-outlined">analytics</span>
                </div>
                <div className={`${styles["feature-text"]} ${styles["default"]}`}>
                  <h4>Báo cáo chuyên sâu</h4>
                  <p>Biểu đồ hóa các chỉ số BMD, T-score và Z-score trực quan.</p>
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
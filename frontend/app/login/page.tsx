"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/app/auth/auth.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email không hợp lệ");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    setIsLoading(true);

    try {
      // Simulate login - replace with actual auth logic
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/dashboard");
    } catch (err) {
      setError("Đăng nhập thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles["login-page"]}>
      <main className={styles["login-main"]}>
        {/* Background Decoration */}
        <div className={styles["bg-decoration"]}>
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwMSl9RVFU9if3vIslYiWgik0q4xTrBAslOxOYduUAhMGcURgTm_qa_HMxlSZkcHgQcIQnMkG9bP3WMWp-rrgqai1I8iSUNqebMx7q9o6FGaUL0VAPY1hbPOeFZO6mUdVevMIJxSDCu8x3ep30r4OBWJr1eknuGnzCPoeoTRzav0zJqvsHC-u1rzY1VJnEDtW0gH57yn4r-pQvP13w8-iHadd2tqXD4gWrr2QNODcfBO5PBCDVG5aDRufemScEvWm3XWMUTfmZqHIV"
            alt="Medical background"
          />
        </div>

        <div className={styles["login-content"]}>
          {/* Form Section */}
          <div>
            {/* Brand */}
            <div className={styles["login-brand"]}>
              <div className={styles["brand-logo"]}>
                <span className="material-symbols-outlined">health_metrics</span>
              </div>
              <div className={styles["brand-text"]}>
                <h1>OsteoScan DXA</h1>
                <p>Diagnostic Excellence</p>
              </div>
            </div>

            {/* Form Card */}
            <div className={styles["form-card"]}>
              <header className={styles["form-header"]}>
                <h2>Đăng nhập hệ thống</h2>
                <p>Vui lòng nhập thông tin để truy cập hồ sơ bệnh nhân.</p>
              </header>

              {error && (
                <div className={`${styles.alert} ${styles["alert-error"]}`}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* Email Field */}
                <div className={styles["input-group"]}>
                  <label>Tên đăng nhập hoặc Email</label>
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

                {/* Password Field */}
                <div className={styles["input-group"]}>
                  <label>Mật khẩu</label>
                  <div className={styles["input-wrapper"]}>
                    <span className={styles["input-icon"]}>
                      <span className="material-symbols-outlined">lock</span>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`${styles["form-input"]} ${styles["password-input"]}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className={styles["password-toggle"]}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Options Row */}
                <div className={styles["options-row"]}>
                  <label className={styles["checkbox-wrapper"]}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>
                  <Link href="/forgot-password" className={styles["footer-link"]}>
                    Quên mật khẩu?
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className={styles["btn-primary"]}
                  disabled={isLoading}
                >
                  <span>Đăng nhập</span>
                  <span className="material-symbols-outlined">login</span>
                </button>
              </form>

              {/* Trust Bar */}
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

          {/* Right Side Visual */}
          <div className={styles["login-visual"]}>
            <div className={styles["visual-content"]}>
              <h3>Phân tích mật độ xương thế hệ mới.</h3>
              <p>
                OsteoScan DXA cung cấp độ chính xác tối ưu trong chẩn đoán loãng
                xương và đánh giá rủi ro gãy xương cho bệnh nhân.
              </p>

              <div className={styles["feature-card"] + " " + styles["primary"]}>
                <div className={styles["feature-icon"] + " " + styles["primary"]}>
                  <span className="material-symbols-outlined">speed</span>
                </div>
                <div className={styles["feature-text"]}>
                  <h4>Xử lý thời gian thực</h4>
                  <p>Kết quả phân tích có ngay sau khi quét với sai số tối thiểu.</p>
                </div>
              </div>

              <div className={styles["feature-card"] + " " + styles["default"]}>
                <div className={styles["feature-icon"] + " " + styles["default"]}>
                  <span className="material-symbols-outlined">analytics</span>
                </div>
                <div className={styles["feature-text"] + " " + styles["default"]}>
                  <h4>Báo cáo chuyên sâu</h4>
                  <p>Biểu đồ hóa các chỉ số BMD, T-score và Z-score trực quan.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
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
          <div className={styles["footer-links-divider"]}></div>
          <div className={styles["status-indicator"]}>
            <div className={styles["status-dot"]}></div>
            <span className={styles["status-text"]}>Hệ thống đang hoạt động</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
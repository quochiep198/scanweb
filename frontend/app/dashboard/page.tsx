"use client";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { useAuth } from "@/app/context/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute>
      <main style={{ minHeight: "100vh", padding: "40px", fontFamily: "Inter, sans-serif" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "32px" }}>Dashboard</h1>
              <p style={{ margin: "8px 0 0", color: "#5f6368" }}>
                {user ? `Xin chao, ${user.name}` : "Ban da dang nhap thanh cong."}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              style={{
                border: "none",
                borderRadius: "10px",
                background: "#111827",
                color: "#ffffff",
                padding: "12px 18px",
                cursor: "pointer",
              }}
            >
              Dang xuat
            </button>
          </div>

          <section
            style={{
              borderRadius: "18px",
              padding: "24px",
              background: "#f7f8fa",
              border: "1px solid #e5e7eb",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Thong tin tai khoan</h2>
            <p style={{ marginBottom: "8px" }}>
              <strong>Ho ten:</strong> {user?.name || "-"}
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Email:</strong> {user?.email || "-"}
            </p>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

"use client";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { useAuth } from "@/app/context/AuthContext";
import { DashboardShell } from "@/components/layouts/DashboardShell";

const statCards = [
  {
    icon: "dataset",
    title: "Dataset san sang",
    value: "128 tep",
    detail: "Dong bo du lieu tu 3 thiet bi DXA trong ngay hom nay.",
  },
  {
    icon: "monitoring",
    title: "Lan huan luyen gan nhat",
    value: "09:40",
    detail: "Mo hinh OsteoScan v2.4 da duoc cap nhat 24 phut truoc.",
  },
  {
    icon: "verified",
    title: "Ty le du lieu hop le",
    value: "96.8%",
    detail: "Chi 4 tep can kiem tra lai metadata truoc khi dua vao train.",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <DashboardShell>
        <section
          style={{
            display: "grid",
            gap: "28px",
          }}
        >
          <header
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#0f43a9",
              }}
            >
              Tong quan van hanh
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: "3rem",
                lineHeight: 1.05,
                letterSpacing: "-0.05em",
                color: "#123a8f",
              }}
            >
              Dashboard OsteoScan DXA
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: "760px",
                fontSize: "1.18rem",
                lineHeight: 1.6,
                color: "#4f586c",
              }}
            >
              {user
                ? `Xin chao ${user.name}. Khu vuc nay duoc tach san thanh dashboard shell de dung chung cho cac man hinh noi bo, bao gom Upload va cac menu tiep theo.`
                : "Ban da dang nhap thanh cong."}
            </p>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            {statCards.map((card) => (
              <article
                key={card.title}
                style={{
                  padding: "22px",
                  borderRadius: "24px",
                  border: "1px solid #d7dfef",
                  background: "rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 18px 40px rgba(24, 54, 111, 0.08)",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "16px",
                    background: "linear-gradient(180deg, #e7f0ff, #d6e7ff)",
                    color: "#155dca",
                    marginBottom: "18px",
                  }}
                >
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "#5b6475",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {card.title}
                </p>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: "2rem",
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    color: "#172033",
                  }}
                >
                  {card.value}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    lineHeight: 1.6,
                    color: "#4f586c",
                  }}
                >
                  {card.detail}
                </p>
              </article>
            ))}
          </div>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.9fr)",
              gap: "18px",
            }}
          >
            <article
              style={{
                padding: "28px",
                borderRadius: "28px",
                background:
                  "linear-gradient(135deg, rgba(16, 69, 168, 0.96), rgba(16, 119, 221, 0.9))",
                color: "#fff",
                boxShadow: "0 22px 50px rgba(13, 61, 155, 0.24)",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "0.95rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  opacity: 0.82,
                }}
              >
                Workspace moi
              </p>
              <h2
                style={{
                  margin: "0 0 12px",
                  fontSize: "2rem",
                  lineHeight: 1.12,
                  letterSpacing: "-0.04em",
                }}
              >
                Man hinh Upload da duoc tach thanh mot module rieng trong sidebar.
              </h2>
              <p
                style={{
                  margin: 0,
                  maxWidth: "680px",
                  fontSize: "1.05rem",
                  lineHeight: 1.7,
                  opacity: 0.92,
                }}
              >
                Giai doan nay chi tap trung vao giao dien. Luong xu ly thuc te, phan quyen admin va ket noi
                backend se duoc them sau.
              </p>
            </article>

            <article
              style={{
                padding: "28px",
                borderRadius: "28px",
                border: "1px solid #d7dfef",
                background: "rgba(255, 255, 255, 0.92)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 18px",
                  fontSize: "1.4rem",
                  lineHeight: 1.2,
                  color: "#182132",
                }}
              >
                Tai khoan hien tai
              </h3>
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <p style={{ margin: "0 0 4px", color: "#5b6475", fontWeight: 700 }}>Ho ten</p>
                  <p style={{ margin: 0, color: "#182132", fontSize: "1.05rem" }}>{user?.name || "-"}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", color: "#5b6475", fontWeight: 700 }}>Email</p>
                  <p style={{ margin: 0, color: "#182132", fontSize: "1.05rem" }}>{user?.email || "-"}</p>
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", color: "#5b6475", fontWeight: 700 }}>Trang thai</p>
                  <p style={{ margin: 0, color: "#0f8a43", fontWeight: 700 }}>San sang thao tac</p>
                </div>
              </div>
            </article>
          </section>
        </section>
      </DashboardShell>
    </ProtectedRoute>
  );
}

"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { useAuth } from "@/app/context/AuthContext";
import { DashboardShell } from "@/components/layouts/DashboardShell";

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [stats, setStats] = useState({
    uploadTodayCount: 0,
    trainedTodayCount: 0,
  });

  useEffect(() => {
    if (!accessToken) return;

    const fetchStats = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const response = await fetch(`${API_URL}/v1/dashboard/stats`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            uploadTodayCount: data.upload_today_count,
            trainedTodayCount: data.trained_today_count,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, [accessToken]);

  const cards = [
    {
      icon: "dataset",
      title: "Mẫu upload hôm nay",
      value: `${stats.uploadTodayCount} tệp`,
      detail: "Số lượng ảnh X-ray đã được upload lên hệ thống trong ngày hôm nay.",
    },
    {
      icon: "monitoring",
      title: "Mẫu đã training hôm nay",
      value: `${stats.trainedTodayCount} tệp`,
      detail: "Số lượng mẫu đã hoàn thành huấn luyện cho AI trong ngày hôm nay.",
    },
    {
      icon: "verified",
      title: "Tỷ lệ dữ liệu hợp lệ",
      value: "96.8%",
      detail: "Chi 4 tệp cần kiểm tra lại metadata trước khi đưa vào train.",
    },
  ];

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
            {cards.map((card) => (
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

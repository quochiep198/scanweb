"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../dashboard/dashboard.module.css";
import { messages } from "@/app/messages";

type DashboardViewProps = {
  onViewChange?: (view: string) => void;
  onSelectMeasurement?: (measurement: any) => void;
};

export default function DashboardPage({ onViewChange, onSelectMeasurement }: DashboardViewProps = {}) {
  const m = messages.dashboard;
  const { user, isAuthenticated } = useAuth();
  
  const [stats, setStats] = useState({
    uploadTodayCount: 0,
    trainedTodayCount: 0,
    uploadCount: 0,
    distribution: {
      normal: 0,
      osteopenia: 0,
      osteoporosis: 0
    },
    agreementRate: 0.0,
    totalReviewed: 0,
    recentMeasurements: [] as any[]
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStats = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/v1/dashboard/stats`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            uploadTodayCount: data.upload_today_count,
            trainedTodayCount: data.trained_today_count,
            uploadCount: data.upload_count,
            distribution: data.distribution || { normal: 0, osteopenia: 0, osteoporosis: 0 },
            agreementRate: data.agreement_rate || 0.0,
            totalReviewed: data.total_reviewed || 0,
            recentMeasurements: data.recent_measurements || []
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isAuthenticated]);

  const cards = [
    {
      icon: "dataset",
      title: m.uploadTodayTitle,
      value: `${stats.uploadTodayCount}`,
      detail: m.uploadTodayDesc,
    },
    {
      icon: "monitoring",
      title: m.trainedTodayTitle,
      value: `${stats.trainedTodayCount}`,
      detail: m.trainedTodayDesc,
    },
    {
      icon: "dataset",
      title: m.totalUploadTitle,
      value: `${stats.uploadCount}`,
      detail: m.totalUploadDesc,
    }
  ];

  const totalCases = stats.distribution.normal + stats.distribution.osteopenia + stats.distribution.osteoporosis;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "12px", fontWeight: "bold" }}>{m.statusPending}</span>;
      case "confirmed_correct":
        return <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#dcfce7", color: "#15803d", fontSize: "12px", fontWeight: "bold" }}>{m.statusConfirmed}</span>;
      case "corrected_by_doctor":
        return <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#fef9c3", color: "#a16207", fontSize: "12px", fontWeight: "bold" }}>{m.statusCorrected}</span>;
      case "rejected":
        return <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "12px", fontWeight: "bold" }}>{m.statusRejected}</span>;
      default:
        return <span style={{ padding: "4px 8px", borderRadius: "4px", backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "12px", fontWeight: "bold" }}>{status}</span>;
    }
  };

  const getLabelStyle = (label: string) => {
    switch (label) {
      case "normal":
        return { color: "#22c55e", fontWeight: "bold" };
      case "osteopenia":
        return { color: "#eab308", fontWeight: "bold" };
      case "osteoporosis":
        return { color: "#ef4444", fontWeight: "bold" };
      default:
        return {};
    }
  };

  const getLabelText = (label: string) => {
    switch (label) {
      case "normal":
        return m.distNormal.split(" ")[0]; // "Bình thường"
      case "osteopenia":
        return m.distOsteopenia.split(" ")[0]; // "Thiếu xương"
      case "osteoporosis":
        return m.distOsteoporosis.split(" ")[0]; // "Loãng xương"
      default:
        return label;
    }
  };

  // SVGRadial agreement gauge variables
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.agreementRate / 100) * circumference;

  return (
    <section className={styles.page}>
      {/* 1. Stat cards grid */}
      <div className={styles.statsGrid}>
        {cards.map((card) => (
          <article key={card.title} className={styles.statCard}>
            <div className={styles.statIcon}>
              <span className="material-symbols-outlined">{card.icon}</span>
            </div>
            <p className={styles.statLabel}>{card.title}</p>
            <p className={styles.statValue}>{card.value}</p>
            <p className={styles.statDetail}>{card.detail}</p>
          </article>
        ))}
      </div>

      {/* 2. Hero & Account grid layout */}
      <div className={styles.featureGrid} style={{ marginTop: "8px" }}>
        {/* Welcome Banner */}
        <article className={styles.heroCard} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "220px" }}>
          <div>
            <p className={styles.heroEyebrow}>OSTEO-SCAN AI PLATFORM</p>
            <h2 className={styles.heroTitle}>{m.welcomeTitle(user?.name || "Bác sĩ")}</h2>
            <p className={styles.heroDescription}>{m.welcomeDesc}</p>
          </div>
          <div>
            <button 
              type="button"
              style={{
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "#ffffff",
                color: "#103f9c",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                transition: "transform 0.2s ease"
              }}
              onClick={() => onViewChange && onViewChange("measurement")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>straighten</span>
              {m.btnQuickAnalyze}
            </button>
          </div>
        </article>

        {/* Account Info */}
        <article className={styles.accountCard}>
          <h3 className={styles.sectionTitle}>{m.systemCardTitle}</h3>
          <div className={styles.accountList}>
            <div className={styles.accountItem}>
              <p className={styles.accountLabel}>{m.activeUserLabel}</p>
              <p className={styles.accountValue}>{user?.name || "N/A"}</p>
            </div>
            <div className={styles.accountItem}>
              <p className={styles.accountLabel}>{m.emailLabel}</p>
              <p className={styles.accountValue}>{user?.email || "N/A"}</p>
            </div>
            <div className={styles.accountItem}>
              <p className={styles.accountLabel}>{m.roleLabel}</p>
              <p className={styles.accountValue}>{m.roleDoctor}</p>
            </div>
            <div className={styles.accountItem}>
              <p className={styles.accountLabel}>{m.dbStatusLabel}</p>
              <p className={`${styles.accountValue} ${styles.statusReady}`}>{m.dbStatusConnected}</p>
            </div>
            <div className={styles.accountItem}>
              <p className={styles.accountLabel}>{m.retrainScheduleLabel}</p>
              <p className={styles.accountValue}>{m.retrainScheduleWeekly}</p>
            </div>
          </div>
        </article>
      </div>

      {/* 3. Distribution Charts & Stats Section */}
      <article style={{ border: "1px solid #d5deee", borderRadius: "10px", backgroundColor: "rgba(255, 255, 255, 0.92)", padding: "16px 18px", boxShadow: "0 6px 16px rgba(25, 48, 96, 0.05)", display: "grid", gap: "12px", marginTop: "8px" }}>
        <div>
          <h3 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="material-symbols-outlined" style={{ color: "#155dca" }}>query_stats</span>
            {m.chartTitle}
          </h3>
          <p style={{ fontSize: "0.78rem", color: "#4f586c", margin: "4px 0 0" }}>{m.chartDesc}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", alignItems: "center" }} className="chart-layout-grid">
          {/* A. Diagnosis distribution bar */}
          <div style={{ borderRight: "1px solid #edf2fb", paddingRight: "24px" }} className="bar-chart-container">
            {totalCases > 0 ? (
              <>
                <div style={{ display: "flex", height: "24px", borderRadius: "12px", overflow: "hidden", backgroundColor: "#e2e8f0", margin: "16px 0" }}>
                  {stats.distribution.normal > 0 && (
                    <div style={{ width: `${(stats.distribution.normal / totalCases) * 100}%`, backgroundColor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: "bold" }} title={`${stats.distribution.normal} ca Bình thường`}>
                      {Math.round((stats.distribution.normal / totalCases) * 100)}%
                    </div>
                  )}
                  {stats.distribution.osteopenia > 0 && (
                    <div style={{ width: `${(stats.distribution.osteopenia / totalCases) * 100}%`, backgroundColor: "#eab308", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: "bold" }} title={`${stats.distribution.osteopenia} ca Thiếu xương`}>
                      {Math.round((stats.distribution.osteopenia / totalCases) * 100)}%
                    </div>
                  )}
                  {stats.distribution.osteoporosis > 0 && (
                    <div style={{ width: `${(stats.distribution.osteoporosis / totalCases) * 100}%`, backgroundColor: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: "bold" }} title={`${stats.distribution.osteoporosis} ca Loãng xương`}>
                      {Math.round((stats.distribution.osteoporosis / totalCases) * 100)}%
                    </div>
                  )}
                </div>

                {/* Bar Chart Legend */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#22c55e" }}></span>
                    <span>{m.distNormal}: <strong>{stats.distribution.normal}</strong> {m.caseUnit}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#eab308" }}></span>
                    <span>{m.distOsteopenia}: <strong>{stats.distribution.osteopenia}</strong> {m.caseUnit}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444" }}></span>
                    <span>{m.distOsteoporosis}: <strong>{stats.distribution.osteoporosis}</strong> {m.caseUnit}</span>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>{m.noDataChart}</p>
            )}
          </div>

          {/* B. AI agreement rate circle gauge */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "center" }} className="gauge-container">
            <div style={{ position: "relative", width: "100px", height: "100px" }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r={radius} 
                  stroke="#155dca" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "15px", fontWeight: "bold", color: "#182132" }}>
                {stats.agreementRate}%
              </div>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "13px", color: "#182132" }}>{m.agreementRateLabel}</h4>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#5b6475" }}>
                {m.totalReviewedLabel}: <strong>{stats.totalReviewed}</strong>
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* 4. Recent scans table */}
      <article style={{ border: "1px solid #d5deee", borderRadius: "10px", backgroundColor: "rgba(255, 255, 255, 0.92)", padding: "16px 18px", boxShadow: "0 6px 16px rgba(25, 48, 96, 0.05)", marginTop: "8px" }}>
        <h3 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span className="material-symbols-outlined" style={{ color: "#155dca" }}>history</span>
          {m.recentScansTitle}
        </h3>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", color: "#9ca3af" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "36px", animation: "spin 2s linear infinite", color: "#155dca", marginBottom: "8px" }}>sync</span>
            <p style={{ fontSize: "0.82rem" }}>Đang tải danh sách ca chẩn đoán gần đây...</p>
          </div>
        ) : stats.recentMeasurements.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #edf2fb", color: "#4f586c", fontWeight: "bold" }}>
                  <th style={{ padding: "10px 8px" }}>ID</th>
                  <th style={{ padding: "10px 8px" }}>{m.thPatientInfo}</th>
                  <th style={{ padding: "10px 8px" }}>{m.thBmi}</th>
                  <th style={{ padding: "10px 8px" }}>T-Score</th>
                  <th style={{ padding: "10px 8px" }}>{m.thAiResult}</th>
                  <th style={{ padding: "10px 8px" }}>{m.thReviewStatus}</th>
                  <th style={{ padding: "10px 8px" }}>{m.thDate}</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>{m.thAction}</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMeasurements.map((meas) => {
                  const createdDate = meas.created_at 
                    ? new Date(meas.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) 
                    : "N/A";
                  return (
                    <tr key={meas.measurement_id} style={{ borderBottom: "1px solid #edf2fb" }} className="table-row-hover">
                      <td style={{ padding: "12px 8px", fontWeight: "500", color: "#64748b" }}>#{meas.measurement_id}</td>
                      <td style={{ padding: "12px 8px" }}>
                        {meas.age} tuổi ({meas.sex === "M" ? "Nam" : meas.sex === "F" ? "Nữ" : "Khác"})
                      </td>
                      <td style={{ padding: "12px 8px" }}>{meas.bmi ? meas.bmi.toFixed(1) : "N/A"}</td>
                      <td style={{ padding: "12px 8px", fontWeight: "600" }}>{meas.predicted_t_score ? meas.predicted_t_score.toFixed(2) : "N/A"}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <span style={getLabelStyle(meas.predicted_label)}>{getLabelText(meas.predicted_label)}</span>
                        <span style={{ color: "#64748b", fontSize: "11px", marginLeft: "4px" }}>({Math.round(meas.confidence * 100)}%)</span>
                      </td>
                      <td style={{ padding: "12px 8px" }}>{getStatusBadge(meas.review_status)}</td>
                      <td style={{ padding: "12px 8px", color: "#4f586c" }}>{createdDate}</td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => onSelectMeasurement && onSelectMeasurement(meas)}
                          style={{
                            padding: "4px 10px",
                            backgroundColor: "#e7efff",
                            color: "#155dca",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            transition: "background-color 0.2s"
                          }}
                        >
                          {m.btnViewDetail}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px" }}>{m.noRecentScans}</p>
        )}
      </article>

      <style jsx global>{`
        .table-row-hover:hover {
          background-color: #f8fafc;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 960px) {
          .chart-layout-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .bar-chart-container {
            border-right: none !important;
            padding-right: 0 !important;
            border-bottom: 1px solid #edf2fb;
            padding-bottom: 16px;
          }
        }
      `}</style>
    </section>
  );
}

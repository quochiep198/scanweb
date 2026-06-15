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
  
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({
    uploadTodayCount: 0,
    uploadYesterdayCount: 0,
    trainedTodayCount: 0,
    trainedYesterdayCount: 0,
    uploadCount: 0,
    distribution: {
      normal: 0,
      osteopenia: 0,
      osteoporosis: 0
    },
    agreementRate: 0.0,
    totalReviewed: 0,
    recentMeasurements: [] as any[],
    totalMeasurements: 0,
    activeModelVersion: "v1.0.0",
    activeModelAccuracy: 0.885,
    activeModelF1Score: 0.872,
    activeModelTrainedDate: null as string | null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRecentLoading, setIsRecentLoading] = useState(false);

  // Search and filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");

  // Hover Preview States
  const [hoveredMeasurementId, setHoveredMeasurementId] = useState<number | null>(null);
  const [hoveredImageBlobUrl, setHoveredImageBlobUrl] = useState<string | null>(null);
  const [hoveredLoading, setHoveredLoading] = useState(false);
  const [hoveredError, setHoveredError] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Hover chart segment state
  const [hoveredChartSegment, setHoveredChartSegment] = useState<string | null>(null);

  const fetchStats = async (
    pageNum: number, 
    isInitial = false, 
    currentSearch = search, 
    currentStatus = statusFilter, 
    currentLabel = labelFilter
  ) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRecentLoading(true);
    }
    try {
      const apiUrl = getApiUrl();
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: "5",
        search: currentSearch,
        status: currentStatus,
        label: currentLabel
      });
      const response = await fetch(`${apiUrl}/v1/dashboard/stats?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setStats({
          uploadTodayCount: data.upload_today_count,
          uploadYesterdayCount: data.upload_yesterday_count,
          trainedTodayCount: data.trained_today_count,
          trainedYesterdayCount: data.trained_yesterday_count,
          uploadCount: data.upload_count,
          distribution: data.distribution || { normal: 0, osteopenia: 0, osteoporosis: 0 },
          agreementRate: data.agreement_rate || 0.0,
          totalReviewed: data.total_reviewed || 0,
          recentMeasurements: data.recent_measurements || [],
          totalMeasurements: data.total_measurements || 0,
          activeModelVersion: data.active_model_version || "v1.0.0",
          activeModelAccuracy: data.active_model_accuracy || 0.885,
          activeModelF1Score: data.active_model_f1_score || 0.872,
          activeModelTrainedDate: data.active_model_trained_date || null
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setIsLoading(false);
      setIsRecentLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats(page, page === 1 && stats.uploadCount === 0);
    }
  }, [page, isAuthenticated]);

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(stats.totalMeasurements / 5);
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handleStatusFilterChange = (statusVal: string) => {
    setStatusFilter(statusVal);
    setPage(1);
    fetchStats(1, false, search, statusVal, labelFilter);
  };

  const handleLabelFilterChange = (labelVal: string) => {
    setLabelFilter(labelVal);
    setPage(1);
    fetchStats(1, false, search, statusFilter, labelVal);
  };
  
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchStats(1, false, search, statusFilter, labelFilter);
  };

  const handleSearchClear = () => {
    setSearch("");
    setPage(1);
    fetchStats(1, false, "", statusFilter, labelFilter);
  };

  const handleMouseEnterRow = async (measId: number) => {
    if (abortController) {
      abortController.abort();
    }
    const controller = new AbortController();
    setAbortController(controller);
    
    setHoveredMeasurementId(measId);
    setHoveredLoading(true);
    setHoveredError(false);
    setHoveredImageBlobUrl(null);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/v1/measure/${measId}/image`, {
        credentials: "include",
        signal: controller.signal
      });
      if (response.ok) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setHoveredImageBlobUrl(objectUrl);
      } else {
        setHoveredError(true);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error(e);
        setHoveredError(true);
      }
    } finally {
      if (controller === abortController) {
        setHoveredLoading(false);
      }
    }
  };

  const handleMouseLeaveRow = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    if (hoveredImageBlobUrl) {
      URL.revokeObjectURL(hoveredImageBlobUrl);
    }
    setHoveredMeasurementId(null);
    setHoveredImageBlobUrl(null);
    setHoveredLoading(false);
    setHoveredError(false);
  };

  useEffect(() => {
    return () => {
      if (hoveredImageBlobUrl) {
        URL.revokeObjectURL(hoveredImageBlobUrl);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [hoveredImageBlobUrl, abortController]);

  const cards = [
    {
      icon: "dataset",
      title: m.uploadTodayTitle,
      value: `${stats.uploadTodayCount}`,
      yesterdayValue: stats.uploadYesterdayCount,
      detail: m.uploadTodayDesc,
    },
    {
      icon: "monitoring",
      title: m.trainedTodayTitle,
      value: `${stats.trainedTodayCount}`,
      yesterdayValue: stats.trainedYesterdayCount,
      detail: m.trainedTodayDesc,
    },
    {
      icon: "dataset",
      title: m.totalUploadTitle,
      value: `${stats.uploadCount}`,
      yesterdayValue: undefined,
      detail: m.totalUploadDesc,
    }
  ];

  const totalCases = stats.distribution.normal + stats.distribution.osteopenia + stats.distribution.osteoporosis;
  const totalPages = Math.max(1, Math.ceil(stats.totalMeasurements / 5));

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

  const getTrendBadge = (todayCount: number, yesterdayCount: number) => {
    if (yesterdayCount === undefined || yesterdayCount === null) {
      return <span style={{ fontSize: "11px", color: "#64748b" }}>{m.trendNoData}</span>;
    }
    if (yesterdayCount === 0) {
      if (todayCount > 0) {
        return (
          <span style={{ fontSize: "11px", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "2px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px", fontWeight: "bold" }}>trending_up</span>
            +{todayCount} ca
          </span>
        );
      }
      return <span style={{ fontSize: "11px", color: "#64748b" }}>{m.trendNoChange}</span>;
    }
    
    const diff = todayCount - yesterdayCount;
    const pct = Math.round((diff / yesterdayCount) * 100);
    
    if (pct > 0) {
      return (
        <span style={{ fontSize: "11px", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "2px" }} title={m.trendIncrease(pct.toString())}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px", fontWeight: "bold" }}>trending_up</span>
          +{pct}%
        </span>
      );
    } else if (pct < 0) {
      return (
        <span style={{ fontSize: "11px", color: "#dc2626", backgroundColor: "#fee2e2", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "2px" }} title={m.trendDecrease(Math.abs(pct).toString())}>
          <span className="material-symbols-outlined" style={{ fontSize: "14px", fontWeight: "bold" }}>trending_down</span>
          {pct}%
        </span>
      );
    } else {
      return (
        <span style={{ fontSize: "11px", color: "#64748b", backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "2px" }}>
          {m.trendNoChange}
        </span>
      );
    }
  };

  // SVGRadial agreement gauge variables
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.agreementRate / 100) * circumference;

  // SVG Doughnut Chart Math
  const rDoughnut = 36;
  const cDoughnut = 2 * Math.PI * rDoughnut;
  
  const pctNormal = totalCases > 0 ? (stats.distribution.normal / totalCases) * 100 : 0;
  const pctOsteopenia = totalCases > 0 ? (stats.distribution.osteopenia / totalCases) * 100 : 0;
  const pctOsteoporosis = totalCases > 0 ? (stats.distribution.osteoporosis / totalCases) * 100 : 0;
  
  const lenNormal = (pctNormal / 100) * cDoughnut;
  const lenOsteopenia = (pctOsteopenia / 100) * cDoughnut;
  const lenOsteoporosis = (pctOsteoporosis / 100) * cDoughnut;

  return (
    <section className={styles.page}>
      {/* 1. Stat cards grid */}
      <div className={styles.statsGrid}>
        {cards.map((card) => (
          <article key={card.title} className={styles.statCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className={styles.statIcon}>
                <span className="material-symbols-outlined">{card.icon}</span>
              </div>
              {card.yesterdayValue !== undefined && getTrendBadge(parseInt(card.value), card.yesterdayValue)}
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
        <article className={styles.heroCard} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "240px" }}>
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

        {/* Account Info and AI Model stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* <article className={styles.accountCard}>
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
            </div>
          </article> */}

          <article className={styles.accountCard} style={{ padding: "12px 14px" }}>
            <h3 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="material-symbols-outlined" style={{ color: "#155dca", fontSize: "20px" }}>deployed_code</span>
              {m.aiModelDetailsTitle}
            </h3>
            <div className={styles.accountList}>
              <div className={styles.accountItem}>
                <p className={styles.accountLabel}>{m.aiModelVersionLabel}</p>
                <p className={styles.accountValue} style={{ fontWeight: "600", color: "#155dca" }}>{stats.activeModelVersion}</p>
              </div>
              <div className={styles.accountItem}>
                <p className={styles.accountLabel}>{m.aiModelAccuracyLabel}</p>
                <p className={styles.accountValue} style={{ fontWeight: "600" }}>{Math.round(stats.activeModelAccuracy * 1000) / 10}%</p>
              </div>
              <div className={styles.accountItem}>
                <p className={styles.accountLabel}>{m.aiModelF1ScoreLabel}</p>
                <p className={styles.accountValue}>{Math.round(stats.activeModelF1Score * 1000) / 10}%</p>
              </div>
              <div className={styles.accountItem}>
                <p className={styles.accountLabel}>{m.aiModelTrainedDateLabel}</p>
                <p className={styles.accountValue}>
                  {stats.activeModelTrainedDate 
                    ? new Date(stats.activeModelTrainedDate).toLocaleDateString("vi-VN") 
                    : m.aiModelTrainedDateNever}
                </p>
              </div>
            </div>
          </article>
        </div>
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

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", alignItems: "center" }} className="chart-layout-grid">
          {/* A. Diagnosis distribution SVG Doughnut */}
          <div style={{ borderRight: "1px solid #edf2fb", paddingRight: "24px", display: "flex", gap: "24px", alignItems: "center" }} className="bar-chart-container">
            {totalCases > 0 ? (
              <>
                <div style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
                  <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r={rDoughnut} stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                    
                    {stats.distribution.normal > 0 && (
                      <circle 
                        cx="50" 
                        cy="50" 
                        r={rDoughnut} 
                        stroke="#22c55e" 
                        strokeWidth={hoveredChartSegment === "normal" ? "12" : "9"} 
                        fill="transparent" 
                        strokeDasharray={`${lenNormal} ${cDoughnut}`}
                        strokeDashoffset={0}
                        strokeLinecap="round"
                        style={{ cursor: "pointer", transition: "all 0.2s" }}
                        onMouseEnter={() => setHoveredChartSegment("normal")}
                        onMouseLeave={() => setHoveredChartSegment(null)}
                        onClick={() => handleLabelFilterChange("normal")}
                      />
                    )}
                    
                    {stats.distribution.osteopenia > 0 && (
                      <circle 
                        cx="50" 
                        cy="50" 
                        r={rDoughnut} 
                        stroke="#eab308" 
                        strokeWidth={hoveredChartSegment === "osteopenia" ? "12" : "9"} 
                        fill="transparent" 
                        strokeDasharray={`${lenOsteopenia} ${cDoughnut}`}
                        strokeDashoffset={-lenNormal}
                        strokeLinecap="round"
                        style={{ cursor: "pointer", transition: "all 0.2s" }}
                        onMouseEnter={() => setHoveredChartSegment("osteopenia")}
                        onMouseLeave={() => setHoveredChartSegment(null)}
                        onClick={() => handleLabelFilterChange("osteopenia")}
                      />
                    )}
                    
                    {stats.distribution.osteoporosis > 0 && (
                      <circle 
                        cx="50" 
                        cy="50" 
                        r={rDoughnut} 
                        stroke="#ef4444" 
                        strokeWidth={hoveredChartSegment === "osteoporosis" ? "12" : "9"} 
                        fill="transparent" 
                        strokeDasharray={`${lenOsteoporosis} ${cDoughnut}`}
                        strokeDashoffset={-(lenNormal + lenOsteopenia)}
                        strokeLinecap="round"
                        style={{ cursor: "pointer", transition: "all 0.2s" }}
                        onMouseEnter={() => setHoveredChartSegment("osteoporosis")}
                        onMouseLeave={() => setHoveredChartSegment(null)}
                        onClick={() => handleLabelFilterChange("osteoporosis")}
                      />
                    )}
                  </svg>
                  
                  {/* Center Text */}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                    pointerEvents: "none"
                  }}>
                    {hoveredChartSegment === null ? (
                      <>
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1e293b" }}>{totalCases}</div>
                        <div style={{ fontSize: "8px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Tổng ca</div>
                      </>
                    ) : hoveredChartSegment === "normal" ? (
                      <>
                        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#22c55e" }}>{stats.distribution.normal}</div>
                        <div style={{ fontSize: "8px", color: "#22c55e", fontWeight: "bold" }}>Bình thường</div>
                        <div style={{ fontSize: "9px", color: "#64748b" }}>{Math.round(pctNormal)}%</div>
                      </>
                    ) : hoveredChartSegment === "osteopenia" ? (
                      <>
                        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#eab308" }}>{stats.distribution.osteopenia}</div>
                        <div style={{ fontSize: "8px", color: "#eab308", fontWeight: "bold" }}>Thiếu xương</div>
                        <div style={{ fontSize: "9px", color: "#64748b" }}>{Math.round(pctOsteopenia)}%</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "15px", fontWeight: "bold", color: "#ef4444" }}>{stats.distribution.osteoporosis}</div>
                        <div style={{ fontSize: "8px", color: "#ef4444", fontWeight: "bold" }}>Loãng xương</div>
                        <div style={{ fontSize: "9px", color: "#64748b" }}>{Math.round(pctOsteoporosis)}%</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bar Chart Legend */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", width: "100%" }}>
                  <div 
                    onClick={() => handleLabelFilterChange("normal")}
                    style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", backgroundColor: labelFilter === "normal" ? "#f1f5f9" : "transparent" }}
                    className="legend-item"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#22c55e" }}></span>
                      <span>{m.distNormal}</span>
                    </div>
                    <strong>{stats.distribution.normal} {m.caseUnit}</strong>
                  </div>
                  <div 
                    onClick={() => handleLabelFilterChange("osteopenia")}
                    style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", backgroundColor: labelFilter === "osteopenia" ? "#f1f5f9" : "transparent" }}
                    className="legend-item"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#eab308" }}></span>
                      <span>{m.distOsteopenia}</span>
                    </div>
                    <strong>{stats.distribution.osteopenia} {m.caseUnit}</strong>
                  </div>
                  <div 
                    onClick={() => handleLabelFilterChange("osteoporosis")}
                    style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", backgroundColor: labelFilter === "osteoporosis" ? "#f1f5f9" : "transparent" }}
                    className="legend-item"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444" }}></span>
                      <span>{m.distOsteoporosis}</span>
                    </div>
                    <strong>{stats.distribution.osteoporosis} {m.caseUnit}</strong>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: "13px", width: "100%" }}>{m.noDataChart}</p>
            )}
          </div>

          {/* B. AI agreement rate circle gauge */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "center" }} className="gauge-container">
            <div style={{ position: "relative", width: "100px", height: "100px" }}>
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <defs>
                  <linearGradient id="gradientAgreement" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#155dca" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r={radius} 
                  stroke="url(#gradientAgreement)" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <span className="material-symbols-outlined" style={{ color: "#155dca" }}>history</span>
            {m.recentScansTitle}
          </h3>

          {/* Minimal pagination controls */}
          {stats.totalMeasurements > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#5b6475" }}>
              <span>Trang {page} / {totalPages}</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="pag-btn"
                  onClick={handlePrevPage}
                  disabled={page === 1 || isRecentLoading}
                  style={{
                    borderRadius: "4px",
                    border: "1px solid #d5deee",
                    backgroundColor: page === 1 ? "#f8fafc" : "#ffffff",
                    cursor: page === 1 ? "not-allowed" : "pointer",
                    color: page === 1 ? "#cbd5e1" : "#155dca",
                    opacity: page === 1 ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                  title="Trang trước"
                >
                  <span className="material-symbols-outlined" style={{ fontWeight: "bold" }}>chevron_left</span>
                </button>
                <button
                  type="button"
                  className="pag-btn"
                  onClick={handleNextPage}
                  disabled={page === totalPages || isRecentLoading}
                  style={{
                    borderRadius: "4px",
                    border: "1px solid #d5deee",
                    backgroundColor: page === totalPages ? "#f8fafc" : "#ffffff",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    color: page === totalPages ? "#cbd5e1" : "#155dca",
                    opacity: page === totalPages ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                  title="Trang sau"
                >
                  <span className="material-symbols-outlined" style={{ fontWeight: "bold" }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "6px", flex: "1 1 240px", maxWidth: "400px" }}>
            <div style={{ position: "relative", width: "100%" }}>
              <span className="material-symbols-outlined" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "#64748b" }}>search</span>
              <input
                type="text"
                placeholder={m.searchPlaceholder}
                className="search-input-custom"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 12px 6px 38px",
                  fontSize: "13px",
                  borderRadius: "6px",
                  border: "1px solid #d5deee",
                  outline: "none",
                  transition: "border-color 0.2s"
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#64748b" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
                </button>
              )}
            </div>
            <button
              type="submit"
              style={{
                padding: "6px 12px",
                backgroundColor: "#155dca",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
            >
              Tìm
            </button>
          </form>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              value={labelFilter}
              onChange={(e) => handleLabelFilterChange(e.target.value)}
              style={{
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid #d5deee",
                backgroundColor: "#ffffff",
                color: "#1e293b",
                outline: "none"
              }}
            >
              <option value="all">{m.filterLabelAll}</option>
              <option value="normal">{m.distNormal.split(" ")[0]}</option>
              <option value="osteopenia">{m.distOsteopenia.split(" ")[0]}</option>
              <option value="osteoporosis">{m.distOsteoporosis.split(" ")[0]}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              style={{
                padding: "6px 10px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid #d5deee",
                backgroundColor: "#ffffff",
                color: "#1e293b",
                outline: "none"
              }}
            >
              <option value="all">{m.filterStatusAll}</option>
              <option value="pending">{m.statusPending}</option>
              <option value="confirmed_correct">{m.statusConfirmed}</option>
              <option value="corrected_by_doctor">{m.statusCorrected}</option>
              <option value="rejected">{m.statusRejected}</option>
            </select>

            {(labelFilter !== "all" || statusFilter !== "all" || search !== "") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setLabelFilter("all");
                  setPage(1);
                  fetchStats(1, false, "", "all", "all");
                }}
                style={{
                  padding: "6px 10px",
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>filter_alt_off</span>
                Đặt lại
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", color: "#9ca3af" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "36px", animation: "spin 2s linear infinite", color: "#155dca", marginBottom: "8px" }}>sync</span>
            <p style={{ fontSize: "0.82rem" }}>Đang tải danh sách ca chẩn đoán gần đây...</p>
          </div>
        ) : isRecentLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", color: "#9ca3af", minHeight: "220px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "36px", animation: "spin 2s linear infinite", color: "#155dca", marginBottom: "8px" }}>sync</span>
            <p style={{ fontSize: "0.82rem" }}>Đang lật trang dữ liệu...</p>
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
                      <td 
                        style={{ padding: "12px 8px", fontWeight: "500", color: "#64748b", position: "relative", cursor: "help" }}
                        onMouseEnter={() => handleMouseEnterRow(meas.measurement_id)}
                        onMouseLeave={handleMouseLeaveRow}
                      >
                        #{meas.measurement_id}
                        
                        {/* Quick Image Preview Tooltip */}
                        {hoveredMeasurementId === meas.measurement_id && (
                          <div style={{
                            position: "absolute",
                            top: "80%",
                            left: "24px",
                            zIndex: 100,
                            backgroundColor: "#ffffff",
                            border: "1px solid #d5deee",
                            borderRadius: "8px",
                            padding: "8px",
                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                            width: "160px",
                            minHeight: "160px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            pointerEvents: "none"
                          }}>
                            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#4f586c", marginBottom: "6px", width: "100%", textAlign: "center", borderBottom: "1px solid #edf2fb", paddingBottom: "4px" }}>
                              {m.hoverPreviewTitle}
                            </div>
                            {hoveredLoading && (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                                <span className="material-symbols-outlined" style={{ animation: "spin 1.5s linear infinite", color: "#155dca", fontSize: "20px" }}>sync</span>
                                <span style={{ fontSize: "10px", color: "#64748b" }}>{m.hoverPreviewLoading}</span>
                              </div>
                            )}
                            {hoveredError && (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "#ef4444" }}>
                                <span className="material-symbols-outlined">error</span>
                                <span style={{ fontSize: "10px" }}>{m.hoverPreviewError}</span>
                              </div>
                            )}
                            {hoveredImageBlobUrl && (
                              <img 
                                src={hoveredImageBlobUrl} 
                                alt="X-ray Preview" 
                                style={{ width: "100%", height: "120px", objectFit: "contain", borderRadius: "4px", backgroundColor: "#1e293b" }} 
                              />
                            )}
                          </div>
                        )}
                      </td>
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
        .legend-item:hover {
          background-color: #f1f5f9;
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

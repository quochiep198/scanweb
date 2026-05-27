"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { DashboardShell } from "@/components/layouts/DashboardShell";
import styles from "./measurement.module.css";

type LogType = {
  time: string;
  text: string;
  type?: "success" | "error" | "default" | "primary";
};

export default function MeasurementPage() {
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [coordinates, setCoordinates] = useState("X: ---.-- | Y: ---.-- | Z: -.--");
  
  // Metrics state
  const [tScore, setTScore] = useState<number | "- -">("- -");
  const [zScore, setZScore] = useState<number | "- -">("- -");
  const [bmd, setBmd] = useState<string>("0.000");

  // Parameter controls state
  const [kvp, setKvp] = useState("76 kVp (Tiêu chuẩn)");
  const [scanSpeed, setScanSpeed] = useState<"slow" | "medium" | "fast">("medium");
  const [filterDenoise, setFilterDenoise] = useState(true);
  const [filterSharpen, setFilterSharpen] = useState(false);

  // System logs state
  const [logs, setLogs] = useState<LogType[]>([]);

  // Simulation timer reference
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Ref tracking logged zones to prevent duplicate log entries
  const loggedZonesRef = useRef({ L1: false, L2: false, L3: false, L4: false });

  // Initialize background logs on mount
  useEffect(() => {
    const getPastTime = (secondsAgo: number) => {
      const d = new Date(Date.now() - secondsAgo * 1000);
      return d.toLocaleTimeString("vi-VN", { hour12: false });
    };

    setLogs([
      { time: getPastTime(5), text: "Đang chờ lệnh bắt đầu quét...", type: "primary" },
      { time: getPastTime(55), text: "Hiệu chuẩn hoàn tất (Độ lệch: 0.02%)." },
      { time: getPastTime(115), text: "Đã kết nối với đầu dò DXA (Model-X2)." },
      { time: getPastTime(120), text: "Hệ thống khởi động thành công.", type: "success" },
    ]);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Helper to add system logs with current timestamp
  const addLog = (text: string, type?: "success" | "error" | "default" | "primary") => {
    const timeStr = new Date().toLocaleTimeString("vi-VN", { hour12: false });
    setLogs((prev) => [{ time: timeStr, text, type }, ...prev]);
  };

  // Start simulation trigger
  const handleStartScan = () => {
    if (isScanning) return;

    // Reset simulator states
    setIsScanning(true);
    setProgress(0);
    setTScore("- -");
    setZScore("- -");
    setBmd("0.000");
    loggedZonesRef.current = { L1: false, L2: false, L3: false, L4: false };

    addLog("Bắt đầu quy trình quét mật độ xương...", "success");

    let currentProgress = 0;

    intervalRef.current = setInterval(() => {
      // Determine increment based on speed parameter
      let increment = 1;
      if (scanSpeed === "fast") {
        increment = 2.5 + Math.random() * 3.5; // ~15-25 steps
      } else if (scanSpeed === "medium") {
        increment = 1.0 + Math.random() * 1.5; // ~40-60 steps
      } else {
        increment = 0.4 + Math.random() * 0.5; // ~100-150 steps
      }

      currentProgress += increment;

      // Handle scan completion
      if (currentProgress >= 100) {
        currentProgress = 100;
        setProgress(100);
        setIsScanning(false);
        setTScore(-2.4);
        setZScore(-0.9);
        setBmd("0.791");
        setCoordinates("X: 242.02 | Y: 118.45 | Z: 0.12");
        addLog("Quét hoàn tất. Dữ liệu đã được lưu vào hồ sơ.", "success");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        return;
      }

      setProgress(Math.floor(currentProgress));

      // Coordinate updates with live jitter
      const liveX = (240 + Math.random() * 6).toFixed(2);
      const liveY = (116 + Math.random() * 4).toFixed(2);
      const liveZ = (0.05 + Math.random() * 0.1).toFixed(2);
      setCoordinates(`X: ${liveX} | Y: ${liveY} | Z: ${liveZ}`);

      // Metrics updates with live jitter relative to progress
      if (currentProgress > 5) {
        const progressFactor = currentProgress / 100;
        // Slide values from normal towards osteopenia/osteoporosis bounds with small jitter
        const simulatedT = -0.5 - (1.8 * progressFactor) + (Math.random() * 0.2 - 0.1);
        const simulatedZ = -0.1 - (0.8 * progressFactor) + (Math.random() * 0.1 - 0.05);
        const simulatedBmd = 0.950 - (0.155 * progressFactor) + (Math.random() * 0.012 - 0.006);

        setTScore(parseFloat(simulatedT.toFixed(1)));
        setZScore(parseFloat(simulatedZ.toFixed(1)));
        setBmd(simulatedBmd.toFixed(3));
      }

      // Checkpoint logging
      const progressFloor = Math.floor(currentProgress);
      if (progressFloor >= 20 && !loggedZonesRef.current.L1) {
        loggedZonesRef.current.L1 = true;
        addLog("Đang quét khu vực đốt sống L1...");
      }
      if (progressFloor >= 45 && !loggedZonesRef.current.L2) {
        loggedZonesRef.current.L2 = true;
        addLog("Đang quét khu vực đốt sống L2...");
      }
      if (progressFloor >= 70 && !loggedZonesRef.current.L3) {
        loggedZonesRef.current.L3 = true;
        addLog("Đang quét khu vực đốt sống L3...");
      }
      if (progressFloor >= 90 && !loggedZonesRef.current.L4) {
        loggedZonesRef.current.L4 = true;
        addLog("Đang quét khu vực đốt sống L4...");
      }
    }, 120);
  };

  // Stop simulation trigger
  const handleStopScan = () => {
    if (!isScanning) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsScanning(false);
    addLog("Tiến trình bị tạm dừng bởi người dùng.", "error");
  };

  // Gauge calculations
  // Map T-Score range (-3.0 to +1.0) into a 0-100% position
  const getTScorePercent = () => {
    if (tScore === "- -") return 50;
    const mapped = ((tScore + 3) / 4) * 100;
    return Math.min(Math.max(mapped, 0), 100);
  };

  // Map Z-Score range (-2.0 to +2.0) into a 0-100% fill bar width
  const getZScorePercent = () => {
    if (zScore === "- -") return 0;
    const mapped = ((zScore + 2) / 4) * 100;
    return Math.min(Math.max(mapped, 0), 100);
  };

  // Calculate diagnostic labels and colors
  const getTScoreStatusText = () => {
    if (tScore === "- -") return "Chờ dữ liệu...";
    if (tScore <= -2.5) return "Loãng xương (Osteoporosis)";
    if (tScore <= -1.0) return "Thiếu xương (Osteopenia)";
    return "Bình thường";
  };

  const getTScoreStatusClass = () => {
    if (tScore === "- -") return styles.textGray;
    if (tScore <= -2.5) return styles.textRed;
    if (tScore <= -1.0) return styles.textYellow;
    return styles.textGreen;
  };

  const getZScoreStatusText = () => {
    if (zScore === "- -") return "Chờ dữ liệu...";
    if (zScore < -2.0) return "Thấp hơn trung bình tuổi";
    return "Trong giới hạn bình thường";
  };

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className={styles.container}>
          {/* Patient Header Info */}
          <section className={styles.patientBanner}>
            <div className={styles.patientGroup}>
              <div className={styles.patientMeta}>
                <div className={styles.avatarCircle}>
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div>
                  <h3 className={styles.patientName}>Nguyễn Văn A</h3>
                  <p className={styles.patientDetails}>ID: DXA-2024-0892 • Nam • 65 tuổi</p>
                </div>
              </div>
              <div className={styles.divider} />
              <div>
                <p className={styles.scanZoneLabel}>Vùng quét</p>
                <p className={styles.scanZoneValue}>Cột sống thắt lưng (L1-L4)</p>
              </div>
              <div className={styles.divider} />
              <div>
                <p className={styles.deviceStatusLabel}>Trạng thái thiết bị</p>
                <div className={styles.deviceStatusValue}>
                  <span className={styles.pulseDot} />
                  <span>Sẵn sàng (Đã hiệu chuẩn)</span>
                </div>
              </div>
            </div>
            <button type="button" className={styles.historyBtn}>
              Xem lịch sử
            </button>
          </section>

          {/* Measurement Viewport */}
          <div className={styles.grid12}>
            {/* Left Column: Live Scan Feed */}
            <section className={styles.scanFeedCol}>
              <div className={styles.liveBadges}>
                <span className={styles.liveBadge}>
                  <span className={styles.pulseDotRed} /> TRỰC TIẾP (LIVE)
                </span>
                <span className={styles.liveBadge}>DXA SENSOR: ON</span>
              </div>
              <div className={styles.scanImageWrapper}>
                <div className={styles.scanImageBgGrad} />
                <img
                  className={styles.scanImage}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvgkfVSBS87xmDtZ-LRxxWAXfemL8wVpWDl1kXAyiMse1ngvagBjiGGo83YdMUv0I9osHnsR-y8wtgCQI1Nei-q4-ilb2LxCybKEUJ7LU4tNg64nxHwWXvaUiio_sTIT5YVaww8jiuisF3wPING1t6xXisKUXFj42TorE5LzzzqCh4yMajeLPhiMiRS9Mu_3nxyNQV0WolCJaNdnKgJ3WjwU6WMng0GmqXrEor4k0_WcYcZI6jYG5Ke89dJcPOFZmLwyT3DhOP8UWv"
                  alt="Lumbar spine DXA bone density scan"
                  style={{
                    filter: `grayscale(100%) brightness(${isScanning ? 1.05 : 0.95}) ${
                      filterSharpen ? "contrast(1.2)" : ""
                    }`,
                  }}
                />
                
                {/* HUD Overlay Grid */}
                <div className={styles.scanGridOverlay}>
                  <div className={styles.gridColsRows}>
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                    <div className={styles.gridCell} />
                  </div>
                </div>

                {/* Scanline Animation */}
                {isScanning && <div className={styles.scanLine} />}

                {/* Coordinate HUD */}
                <div className={styles.scanCoordinates}>{coordinates}</div>
              </div>

              {/* Scan viewport controls */}
              <div className={styles.scanFooter}>
                <div className={styles.progressContainer}>
                  <div>
                    <span className={styles.progressLabel}>Tiến độ quét</span>
                    <div className={styles.progressBarOuter}>
                      <div
                        className={styles.progressBarInner}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <span className={styles.progressText}>{progress}%</span>
                </div>

                <div className={styles.btnActions}>
                  <button
                    type="button"
                    onClick={handleStartScan}
                    disabled={isScanning}
                    className={`${styles.startBtn} ${isScanning ? styles.disabledBtn : ""}`}
                  >
                    <span className="material-symbols-outlined">play_arrow</span> BẮT ĐẦU
                  </button>
                  <button
                    type="button"
                    onClick={handleStopScan}
                    disabled={!isScanning}
                    className={`${styles.stopBtn} ${!isScanning ? styles.disabledBtn : ""}`}
                  >
                    <span className="material-symbols-outlined">stop</span> DỪNG
                  </button>
                </div>
              </div>
            </section>

            {/* Right Column: Real-time Analysis */}
            <div className={styles.analysisCol}>
              {/* Metrics Card */}
              <section className={styles.metricsCard}>
                <div className={styles.metricsHeader}>
                  <h3 className={styles.metricsTitle}>
                    <span className="material-symbols-outlined">analytics</span> Chỉ số thời gian thực
                  </h3>
                  <span className={styles.updateLabel}>Cập nhật: 0.5s</span>
                </div>

                <div className={styles.gaugesGrid}>
                  {/* T-Score Gauge */}
                  <div className={styles.gaugeBox}>
                    <span className={styles.gaugeLabel}>T-SCORE</span>
                    <div className={`${styles.gaugeValue} ${styles.gaugeValuePrimary}`}>
                      {tScore === "- -" ? tScore : tScore.toFixed(1)}
                    </div>
                    <div className={styles.gaugeTrackT}>
                      <div
                        className={styles.gaugePointerT}
                        style={{ left: `${getTScorePercent()}%` }}
                      />
                    </div>
                    <div className={styles.gaugeRanges}>
                      <span>-3.0</span>
                      <span>-1.0</span>
                      <span>+1.0</span>
                    </div>
                    <p className={`${styles.gaugeStatus} ${getTScoreStatusClass()}`}>
                      {getTScoreStatusText()}
                    </p>
                  </div>

                  {/* Z-Score Gauge */}
                  <div className={styles.gaugeBox}>
                    <span className={styles.gaugeLabel}>Z-SCORE</span>
                    <div className={`${styles.gaugeValue} ${styles.gaugeValueSecondary}`}>
                      {zScore === "- -" ? zScore : zScore.toFixed(1)}
                    </div>
                    <div className={styles.gaugeTrackZ}>
                      <div
                        className={styles.gaugeFillZ}
                        style={{ width: `${getZScorePercent()}%` }}
                      />
                    </div>
                    <div className={styles.gaugeRanges}>
                      <span>Lower</span>
                      <span>Normal</span>
                      <span>Higher</span>
                    </div>
                    <p className={`${styles.gaugeStatus} ${styles.textSecondary}`}>
                      {getZScoreStatusText()}
                    </p>
                  </div>
                </div>

                {/* Additional metrics */}
                <div className={styles.statsTable}>
                  <div className={styles.statsRow}>
                    <span className={styles.statsRowLabel}>BMD (g/cm²)</span>
                    <span className={styles.statsRowValue}>{bmd}</span>
                  </div>
                  <div className={styles.statsRow}>
                    <span className={styles.statsRowLabel}>BMC (g)</span>
                    <span className={styles.statsRowValue}>12.42</span>
                  </div>
                  <div className={styles.statsRow}>
                    <span className={styles.statsRowLabel}>Diện tích (cm²)</span>
                    <span className={styles.statsRowValue}>14.15</span>
                  </div>
                </div>
              </section>

              {/* System Logs */}
              <section className={styles.logsBox}>
                <div className={styles.logsHeader}>
                  <span className="material-symbols-outlined">list_alt</span> Nhật ký hệ thống
                </div>
                <div className={styles.logsContainer}>
                  {logs.map((log, index) => {
                    let typeClass = "";
                    if (log.type === "success") typeClass = styles.logSuccess;
                    else if (log.type === "error") typeClass = styles.logError;
                    else if (log.type === "primary") typeClass = styles.logPrimary;

                    return (
                      <p key={index} className={`${styles.logLine} ${typeClass}`}>
                        [{log.time}] {log.text}
                      </p>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* Technical Controls Row */}
          <footer className={styles.controlsGrid}>
            <div className={styles.controlCard}>
              <label className={styles.controlLabel} htmlFor="voltageSelect">Điện áp ống (kVp)</label>
              <select
                id="voltageSelect"
                value={kvp}
                onChange={(e) => setKvp(e.target.value)}
                className={styles.kvpSelect}
              >
                <option>76 kVp (Tiêu chuẩn)</option>
                <option>100 kVp (Dày)</option>
                <option>140 kVp (Dual Energy)</option>
              </select>
            </div>

            <div className={styles.controlCard}>
              <span className={styles.controlLabel}>Tốc độ quét</span>
              <div className={styles.speedButtons}>
                <button
                  type="button"
                  onClick={() => setScanSpeed("slow")}
                  className={`${styles.speedBtn} ${
                    scanSpeed === "slow" ? styles.speedBtnActive : ""
                  }`}
                >
                  Chậm
                </button>
                <button
                  type="button"
                  onClick={() => setScanSpeed("medium")}
                  className={`${styles.speedBtn} ${
                    scanSpeed === "medium" ? styles.speedBtnActive : ""
                  }`}
                >
                  Vừa
                </button>
                <button
                  type="button"
                  onClick={() => setScanSpeed("fast")}
                  className={`${styles.speedBtn} ${
                    scanSpeed === "fast" ? styles.speedBtnActive : ""
                  }`}
                >
                  Nhanh
                </button>
              </div>
            </div>

            <div className={styles.controlCard}>
              <span className={styles.controlLabel}>Bộ lọc hình ảnh</span>
              <div className={styles.filtersGroup}>
                <label className={styles.filterCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={filterDenoise}
                    onChange={(e) => setFilterDenoise(e.target.checked)}
                    className={styles.filterCheckbox}
                  />
                  <span>Khử nhiễu</span>
                </label>
                <label className={styles.filterCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={filterSharpen}
                    onChange={(e) => setFilterSharpen(e.target.checked)}
                    className={styles.filterCheckbox}
                  />
                  <span>Sắc nét</span>
                </label>
              </div>
            </div>

            <div className={styles.controlCard}>
              <button type="button" className={styles.exportBtn}>
                <span className="material-symbols-outlined">picture_as_pdf</span> XUẤT KẾT QUẢ TẠM THỜI
              </button>
            </div>
          </footer>
        </div>
      </DashboardShell>
    </ProtectedRoute>
  );
}

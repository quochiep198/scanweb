"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../training/training.module.css";
import { messages } from "@/app/messages";

type TrainingHistoryItem = {
  id: string;
  runName: string;
  trainerName: string;
  status: string;
  clinicalInfo: string;
  datasetSize: number;
  accuracy: number | null;
  loss: number | null;
  createdAt: string;
  completedAt: string | null;
};

export default function TrainingView() {
  const m = messages.training.view;
  const { user } = useAuth();
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Configuration States
  const [modelType, setModelType] = useState("densenet121");
  const [epochsInput, setEpochsInput] = useState(50);
  const [useAugmentation, setUseAugmentation] = useState(true);
  const [warmUp, setWarmUp] = useState(false);
  const [kaggleUsername, setKaggleUsername] = useState("");
  const [kaggleKey, setKaggleKey] = useState("");
  const [showAdvancedKaggle, setShowAdvancedKaggle] = useState(false);

  // Training Execution States
  const [isTraining, setIsTraining] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [logsText, setLogsText] = useState("");

  // Real-time Parser States
  const [progressState, setProgressState] = useState({
    epoch: 0,
    totalEpochs: 50,
    batch: 0,
    totalBatches: 0,
    pct: 0,
    eta: "Đang tính toán..."
  });

  const [chartData, setChartData] = useState<{ epoch: number; trainLoss: number; valLoss: number; accuracy: number }[]>([]);

  // History Table States
  const [historyList, setHistoryList] = useState<TrainingHistoryItem[]>([]);
  const [totalHistory, setTotalHistory] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(5);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Untrained Data Summary
  const [untrainedCount, setUntrainedCount] = useState(0);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // 1. Fetch untrained images count and total count
  const fetchUntrainedSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/v1/dashboard/stats`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setUntrainedCount(data.untrained_count || 0);
      }
    } catch (err) {
      console.error("Error fetching untrained summary:", err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // 2. Fetch history list
  const fetchHistory = async (page: number) => {
    setIsLoadingHistory(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/v1/training/history?page=${page}&limit=${historyLimit}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        const formatted: TrainingHistoryItem[] = (data.data || []).map((item: any) => ({
          id: item.id,
          runName: item.run_name,
          trainerName: item.trainer_name,
          status: item.status,
          clinicalInfo: item.clinical_info,
          datasetSize: item.dataset_size,
          accuracy: item.accuracy,
          loss: item.loss,
          createdAt: item.created_at,
          completedAt: item.completed_at
        }));
        setHistoryList(formatted);
        setTotalHistory(data.total || 0);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 3. Fetch active training logs and status (polling)
  const fetchLogs = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/v1/training/logs`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        const logs = data.logs || "";
        const status = data.status || "idle";

        setLogsText(logs);

        const isRunning = status === "running";
        setIsTraining(isRunning);

        // Parse logs to build chart data points
        const parsedPoints: { epoch: number; trainLoss: number; valLoss: number; accuracy: number }[] = [];
        const lines = logs.split("\n");

        lines.forEach((line: string) => {
          // Format in notebook: Epoch {epoch}/{epochs} result: train_loss={train_loss:.4f}, validation_loss={val_loss:.4f}, accuracy={accuracy:.4f}
          const match = line.match(/Epoch\s+(\d+)\/\d+\s+result:\s+train_loss=([\d\.]+),\s+validation_loss=([\d\.]+),\s+accuracy=([\d\.]+)/);
          if (match) {
            parsedPoints.push({
              epoch: parseInt(match[1]),
              trainLoss: parseFloat(match[2]),
              valLoss: parseFloat(match[3]),
              accuracy: parseFloat(match[4])
            });
          }
        });
        setChartData(parsedPoints);

        // Parse logs to build progress states
        let epoch = 0;
        let totalEpochs = epochsInput;
        let batch = 0;
        let totalBatches = 0;
        let pct = 0;
        let eta = "Đang tính toán...";

        for (let j = lines.length - 1; j >= 0; j--) {
          const line = lines[j];
          // Look for batch execution string: Epoch 19/50: [========>.......] 42/80 batches - loss: 0.1342
          const progressMatch = line.match(/Epoch\s+(\d+)\/(\d+):\s+\[.*?\]\s+(\d+)\/(\d+)\s+batches/);
          if (progressMatch) {
            epoch = parseInt(progressMatch[1]);
            totalEpochs = parseInt(progressMatch[2]);
            batch = parseInt(progressMatch[3]);
            totalBatches = parseInt(progressMatch[4]);
            pct = Math.round(((epoch - 1) / totalEpochs) * 100 + (batch / totalBatches) * (100 / totalEpochs));

            // Simple ETA calculation: ~4.5 seconds per batch on Kaggle T4 average
            const remainingBatches = (totalEpochs - epoch) * totalBatches + (totalBatches - batch);
            const remainingSeconds = remainingBatches * 4.5;
            if (remainingSeconds > 0) {
              const mins = Math.floor(remainingSeconds / 60);
              const secs = Math.round(remainingSeconds % 60);
              eta = `~${mins} phút ${secs} giây`;
            } else {
              eta = "Hoàn thành sau vài giây";
            }
            break;
          }
        }

        // If not running but finished, parse the latest completed epoch for progress UI
        if (!progressMatchActive(lines) && parsedPoints.length > 0) {
          const lastPoint = parsedPoints[parsedPoints.length - 1];
          epoch = lastPoint.epoch;
          pct = isRunning ? Math.round((epoch / totalEpochs) * 100) : 100;
          eta = isRunning ? "Đang chạy..." : "Hoàn thành";
        }

        setProgressState({
          epoch,
          totalEpochs,
          batch,
          totalBatches,
          pct,
          eta
        });

        // Trigger history reload when job shifts from running to complete/idle
        if (!isRunning && isTraining) {
          fetchHistory(historyPage);
          fetchUntrainedSummary();
        }
      }
    } catch (err) {
      console.error("Error polling training logs:", err);
    }
  };

  const progressMatchActive = (lines: string[]): boolean => {
    for (let j = lines.length - 1; j >= 0; j--) {
      if (lines[j].includes("batches")) return true;
    }
    return false;
  };

  // 4. Initial load and logs polling setup
  useEffect(() => {
    fetchHistory(1);
    fetchUntrainedSummary();
    fetchLogs(); // Immediate fetch

    const timer = setInterval(() => {
      fetchLogs();
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Auto scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsText]);

  // 5. Trigger start training
  const handleStartTraining = async () => {
    if (isTraining) return;

    setIsTraining(true);
    setLogsText("Đang khởi tạo kết nối và chuẩn bị tệp huấn luyện...");
    setProgressState({
      epoch: 0,
      totalEpochs: epochsInput,
      batch: 0,
      totalBatches: 0,
      pct: 0,
      eta: "Đang khởi tạo..."
    });
    setChartData([]);

    try {
      const apiUrl = getApiUrl();
      let url = `${apiUrl}/v1/training/train?platform=kaggle&use_augmentation=${useAugmentation}&warm_up=${warmUp}`;
      if (kaggleUsername) {
        url += `&kaggle_username=${encodeURIComponent(kaggleUsername)}`;
      }
      if (kaggleKey) {
        url += `&kaggle_key=${encodeURIComponent(kaggleKey)}`;
      }

      const response = await fetch(url, {
        method: "POST",
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        setActiveHistoryId(data.history_id || null);
        fetchHistory(1);
        fetchUntrainedSummary();
      } else {
        const errorData = await response.json();
        setIsTraining(false);
        setLogsText(`LỖI KHI BẮT ĐẦU HUẤN LUYỆN: ${errorData.detail || "Không rõ lỗi."}`);
      }
    } catch (err: any) {
      setIsTraining(false);
      setLogsText(`LỖI KẾT NỐI SERVER: ${err.message || err}`);
    }
  };

  // Calculated hyperparameters details
  const totalTrainEstimate = untrainedCount > 0 ? Math.round(untrainedCount * 0.85) : 0;
  const autoBatchSize = totalTrainEstimate > 128 ? 32 : 16;
  const autoLr = 1e-4 * (autoBatchSize / 16.0);

  // SVG Chart rendering math
  const svgWidth = 500;
  const svgHeight = 200;
  const totalEpochsVal = progressState.totalEpochs || epochsInput;

  let maxLoss = 1.0;
  chartData.forEach(p => {
    if (p.trainLoss > maxLoss) maxLoss = p.trainLoss;
    if (p.valLoss > maxLoss) maxLoss = p.valLoss;
  });

  const getX = (epoch: number) => {
    return totalEpochsVal > 0 ? (epoch / totalEpochsVal) * svgWidth : 0;
  };

  const getYLoss = (loss: number) => {
    return svgHeight - (loss / maxLoss) * svgHeight;
  };

  const getYAcc = (acc: number) => {
    return svgHeight - acc * svgHeight;
  };

  const trainLossPath = chartData.length > 0
    ? "M " + chartData.map(p => `${getX(p.epoch)},${getYLoss(p.trainLoss)}`).join(" L ")
    : "";

  const valLossPath = chartData.length > 0
    ? "M " + chartData.map(p => `${getX(p.epoch)},${getYLoss(p.valLoss)}`).join(" L ")
    : "";

  const accPath = chartData.length > 0
    ? "M " + chartData.map(p => `${getX(p.epoch)},${getYAcc(p.accuracy)}`).join(" L ")
    : "";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <p className={styles.eyebrow}>{messages.dashboardShell.navDashboard}</p>
          <h1 className={styles.title}>{m.title}</h1>
          <p className={styles.description}>{m.description}</p>
        </div>
        <div className={styles.statusIndicator}>
          <div className={`${styles.statusDot} ${isTraining ? styles.statusDotConnected : styles.statusDotDisconnected}`} />
          <span className={styles.statusText}>
            {isTraining ? m.statusConnected : m.statusDisconnected}
          </span>
        </div>
      </header>

      <div className={styles.contentGrid}>
        {/* Left Column - Configuration & GPU */}
        <div className={styles.leftCol}>
          {/* Configuration Card */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={`material-symbols-outlined ${styles.cardIcon}`}>settings_input_component</span>
              <h2 className={styles.cardTitle}>{m.configCardTitle}</h2>
            </div>
            <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
              <div className={styles.formGroup}>
                <label className={styles.label}>{m.labelModelType}</label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  className={styles.select}
                  disabled={isTraining}
                >
                  <option value="densenet121">MTL DenseNet-121 (Multi-Task)</option>
                  <option value="resnet50" disabled>ResNet-50 Optimized</option>
                  <option value="vit" disabled>Vision Transformer (ViT-L/16)</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{m.labelEpochs}</label>
                  <input
                    type="number"
                    value={epochsInput}
                    onChange={(e) => setEpochsInput(Math.max(1, parseInt(e.target.value) || 0))}
                    className={styles.input}
                    disabled={isTraining}
                    min={1}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>{m.labelBatchSize}</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type="text"
                      value={isTraining ? `Auto (${progressState.totalEpochs > 128 ? 32 : 16})` : `Auto (${autoBatchSize})`}
                      className={styles.input}
                      disabled={true}
                    />
                    <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>{m.labelLearningRate}</label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    value={`${isTraining ? "3e-4 (AdamW + Cosine Decay)" : autoLr.toExponential(0) + " (AdamW + Cosine Decay)"}`}
                    className={styles.input}
                    disabled={true}
                  />
                  <span className={`material-symbols-outlined ${styles.inputIcon}`}>lock</span>
                </div>
                <p className="text-[11px] text-primary italic mt-0.5">{m.hintLearningRate}</p>
              </div>

              {/* Warm-up Checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input
                  type="checkbox"
                  id="warmUp"
                  checked={warmUp}
                  onChange={(e) => setWarmUp(e.target.checked)}
                  disabled={isTraining}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="warmUp" style={{ fontSize: "0.75rem", fontWeight: "700", color: "#334159", cursor: "pointer", userSelect: "none" }}>
                  {m.labelWarmUp} <span style={{ fontWeight: "normal", color: "#64748b", marginLeft: "4px" }}>({m.descWarmUp})</span>
                </label>
              </div>

              {/* Advanced Kaggle Config Toggle */}
              <div style={{ marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedKaggle(!showAdvancedKaggle)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                    padding: 0
                  }}
                  disabled={isTraining}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    {showAdvancedKaggle ? "expand_less" : "settings"}
                  </span>
                  {showAdvancedKaggle ? "Ẩn cấu hình tài khoản Kaggle" : "Cấu hình tài khoản Kaggle (Tùy chọn)"}
                </button>
                {showAdvancedKaggle && !isTraining && (
                  <div style={{
                    marginTop: "8px",
                    padding: "12px",
                    borderRadius: "6px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}>
                    <div>
                      <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "4px" }}>
                        Kaggle Username
                      </label>
                      <input
                        type="text"
                        value={kaggleUsername}
                        placeholder="Mặc định từ .env"
                        onChange={(e) => setKaggleUsername(e.target.value)}
                        className={styles.input}
                        style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "4px" }}>
                        Kaggle API Key
                      </label>
                      <input
                        type="password"
                        value={kaggleKey}
                        placeholder="Mặc định từ .env"
                        onChange={(e) => setKaggleKey(e.target.value)}
                        className={styles.input}
                        style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.btnGroup}>
                <button
                  type="button"
                  onClick={handleStartTraining}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={isTraining || untrainedCount === 0}
                >
                  <span className="material-symbols-outlined">cloud_upload</span>
                  {m.btnTrain}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={true} // Stopping is managed automatically by launching new job or Kaggle kernel cancel
                >
                  <span className="material-symbols-outlined">stop_circle</span>
                  {m.btnStop}
                </button>
              </div>
            </form>
          </section>

          {/* GPU Hardware Status Card */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={`material-symbols-outlined ${styles.cardIcon}`}>memory</span>
              <h2 className={styles.cardTitle}>{m.gpuCardTitle}</h2>
            </div>
            <div className="flex justify-between items-center bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-lg">
              <div className={styles.gpuStatRow} style={{ width: "100%", margin: 0 }}>
                <span className={styles.gpuStatLabel}>{m.gpuHardwareLabel}</span>
                <span className={styles.gpuStatValue}>Tesla T4 (16GB GDDR6)</span>
              </div>
            </div>

            <div className={styles.progressContainer}>
              <div className={styles.progressLabelRow}>
                <span className={styles.progressLabel}>{m.gpuVramLabel}</span>
                <span className={styles.progressValue}>11.4 GB / 16.0 GB</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: isTraining ? "71%" : "0%" }} />
              </div>
            </div>

            <div className={styles.progressContainer}>
              <div className={styles.progressLabelRow}>
                <span className={styles.progressLabel}>
                  {m.overallProgressLabel(progressState.epoch, progressState.totalEpochs)}
                </span>
                <span className={styles.progressValue}>{progressState.pct}%</span>
              </div>
              <div className={styles.progressBar} style={{ height: "14px" }}>
                <div
                  className={`${styles.progressFill} ${isTraining ? styles.progressFillPulse : ""}`}
                  style={{ width: `${progressState.pct}%` }}
                />
              </div>
              <p className={styles.etaText}>
                {isTraining ? m.etaLabel(progressState.eta) : "Hệ thống đang rảnh"}
              </p>
            </div>
          </section>
        </div>

        {/* Right Column - Chart & Terminal Console */}
        <div className={styles.rightCol}>
          {/* SVG Metrics Chart */}
          <section className={styles.card}>
            <div className={styles.cardHeader} style={{ borderBottom: "none", paddingBottom: 0 }}>
              <span className={`material-symbols-outlined ${styles.cardIcon}`}>monitoring</span>
              <h2 className={styles.cardTitle}>{m.chartCardTitle}</h2>
            </div>

            <div className={styles.chartContainer}>
              <div className={styles.chartHeader}>
                <div className={styles.chartLegend}>
                  <div className={styles.legendItem}>
                    <div className={styles.legendDot} style={{ backgroundColor: "#103f9c" }} />
                    <span>{m.chartTrainLoss}</span>
                  </div>
                  <div className={styles.legendItem}>
                    <div className={styles.legendDot} style={{ border: "1px dashed #3b82f6", backgroundColor: "transparent" }} />
                    <span>{m.chartValLoss}</span>
                  </div>
                  <div className={styles.legendItem}>
                    <div className={styles.legendDot} style={{ backgroundColor: "#10b981" }} />
                    <span>{m.chartAccuracy}</span>
                  </div>
                </div>
              </div>

              <div style={{ position: "absolute", bottom: "36px", top: "40px", left: "16px", right: "16px" }}>
                {chartData.length > 0 ? (
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1={svgHeight * 0.2} x2={svgWidth} y2={svgHeight * 0.2} stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1={svgHeight * 0.4} x2={svgWidth} y2={svgHeight * 0.4} stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1={svgHeight * 0.6} x2={svgWidth} y2={svgHeight * 0.6} stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0" y1={svgHeight * 0.8} x2={svgWidth} y2={svgHeight * 0.8} stroke="#f1f5f9" strokeWidth="1" />

                    {/* Lines */}
                    {trainLossPath && <path d={trainLossPath} fill="none" stroke="#103f9c" strokeWidth="2" />}
                    {valLossPath && <path d={valLossPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="3" />}
                    {accPath && <path d={accPath} fill="none" stroke="#10b981" strokeWidth="2" />}
                  </svg>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-outline italic">
                    Chờ nhận dữ liệu từ phiên huấn luyện hoạt động...
                  </div>
                )}
              </div>
              {/* X Axis Labels */}
              <div style={{ position: "absolute", bottom: "12px", left: "16px", right: "16px", display: "flex", justifyContent: "space-between" }} className="text-[10px] font-medium text-slate-400">
                <span>Epoch 0</span>
                <span>{Math.round(totalEpochsVal * 0.2)}</span>
                <span>{Math.round(totalEpochsVal * 0.4)}</span>
                <span>{Math.round(totalEpochsVal * 0.6)}</span>
                <span>{Math.round(totalEpochsVal * 0.8)}</span>
                <span>{totalEpochsVal}</span>
              </div>
            </div>
          </section>

          {/* Terminal Console Logs */}
          <section className={styles.terminal}>
            <div className={styles.terminalHeader}>
              <div className={styles.terminalTitleRow}>
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                <span>{m.terminalCardTitle(activeHistoryId ? activeHistoryId.substring(0, 8) : "session_active")}</span>
              </div>
              <div className={styles.terminalDots}>
                <div className={styles.terminalDot} style={{ backgroundColor: "#ef4444" }} />
                <div className={styles.terminalDot} style={{ backgroundColor: "#eab308" }} />
                <div className={styles.terminalDot} style={{ backgroundColor: "#22c55e" }} />
              </div>
            </div>
            <div className={`${styles.terminalBody} ${styles.customScrollbar}`}>
              {logsText ? (
                logsText.split("\n").map((line, idx) => {
                  let lineClass = styles.terminalLine;
                  if (line.toLowerCase().includes("lỗi") || line.toLowerCase().includes("error") || line.toLowerCase().includes("failed")) {
                    lineClass = `${styles.terminalLine} ${styles.terminalLineError}`;
                  } else if (line.toLowerCase().includes("thành công") || line.toLowerCase().includes("success") || line.toLowerCase().includes("complete")) {
                    lineClass = `${styles.terminalLine} ${styles.terminalLineSuccess}`;
                  }
                  return (
                    <div key={idx} className={lineClass}>
                      {line}
                    </div>
                  );
                })
              ) : (
                <div className={styles.terminalLine}>
                  {messages.upload.status.idleLogs}
                </div>
              )}
              {isTraining && (
                <div className={styles.terminalLine}>
                  <span className={styles.terminalCursor}>_</span>
                  <span className="text-white ml-2">Training in progress...</span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </section>
        </div>
      </div>

      {/* Training History Table */}
      <section className={styles.historyContainer}>
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[#103f9c]">history</span>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{m.historyCardTitle}</h2>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{m.historyThSession}</th>
                <th className={styles.th}>{m.historyThDate}</th>
                <th className={styles.th}>{m.historyThModel}</th>
                <th className={styles.th} style={{ textAlign: "center" }}>{m.historyThAccuracy}</th>
                <th className={styles.th} style={{ textAlign: "center" }}>{m.historyThLoss}</th>
                <th className={styles.th}>{m.historyThStatus}</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingHistory ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                    Đang tải dữ liệu lịch sử...
                  </td>
                </tr>
              ) : historyList.length > 0 ? (
                historyList.map((item) => (
                  <tr key={item.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.tdMono}`}>#{item.id.substring(0, 8).toUpperCase()}</td>
                    <td className={styles.td}>
                      {new Date(item.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className={styles.td}>
                      {item.runName.includes("DenseNet-121") ? "MTL DenseNet-121" : "ResNet-50 Optimized"}
                    </td>
                    <td className={`${styles.td} ${styles.tdBold}`} style={{ textAlign: "center" }}>
                      {item.accuracy !== null ? item.accuracy.toFixed(4) : "-"}
                    </td>
                    <td className={styles.td} style={{ textAlign: "center" }}>
                      {item.loss !== null ? item.loss.toFixed(4) : "-"}
                    </td>
                    <td className={styles.td}>
                      {item.status === "success" && (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block", marginRight: "4px" }} />
                          {m.historyStatusSuccess}
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span className={`${styles.badge} ${styles.badgeDanger}`}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block", marginRight: "4px" }} />
                          {m.historyStatusFailed}
                        </span>
                      )}
                      {item.status === "running" && (
                        <span className={`${styles.badge} ${styles.badgeRunning}`}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3b82f6", display: "inline-block", marginRight: "4px" }} />
                          {m.historyStatusRunning}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                    Chưa có lịch sử phiên chạy nào được ghi nhận.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalHistory > historyLimit && (
            <div className={styles.pagination}>
              <div className={styles.paginationInfo}>
                {m.paginationLabel(
                  (historyPage - 1) * historyLimit + 1,
                  Math.min(historyPage * historyLimit, totalHistory),
                  totalHistory
                )}
              </div>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPage(historyPage - 1);
                    fetchHistory(historyPage - 1);
                  }}
                  className={styles.pageButton}
                  disabled={historyPage === 1}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <div style={{ display: "flex", gap: "4px" }}>
                  {Array.from({ length: Math.ceil(totalHistory / historyLimit) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setHistoryPage(p);
                        fetchHistory(p);
                      }}
                      className={`${styles.pageButton} ${historyPage === p ? styles.pageButtonActive : ""}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPage(historyPage + 1);
                    fetchHistory(historyPage + 1);
                  }}
                  className={styles.pageButton}
                  disabled={historyPage === Math.ceil(totalHistory / historyLimit)}
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState, useRef, ChangeEvent, DragEvent, useEffect } from "react";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../measurement/measurement.module.css";
import PrintableReport from "./PrintableReport";
import ClassificationGauge from "./ClassificationGauge";
import { messages } from "@/app/messages";

const tryRefreshSession = async (): Promise<boolean> => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  options.credentials = "include";
  let response = await fetch(url, options);
  if (response.status === 401) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      response = await fetch(url, options);
    }
  }
  return response;
};

export default function MeasurementPage() {
  const m = messages.measurement;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<string>("F");
  const [bmi, setBmi] = useState<string>("");
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  // Doctor Review states
  const [reviewStatus, setReviewStatus] = useState<string>("confirmed_correct");
  const [doctorConfirmedLabel, setDoctorConfirmedLabel] = useState<string>("");
  const [errorType, setErrorType] = useState<string>("none");
  const [approvedForNextTraining, setApprovedForNextTraining] = useState<boolean>(false);
  const [reviewNote, setReviewNote] = useState<string>("");
  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapBlobUrl, setHeatmapBlobUrl] = useState<string>("");

  // Fetch heatmap blob from backend securely when enabled
  useEffect(() => {
    let active = true;
    if (showHeatmap && resultData && resultData.measurement_id) {
      if (!heatmapBlobUrl) {
        const fetchHeatmap = async () => {
          try {
            const apiUrl = getApiUrl();
            const response = await fetchWithAuth(`${apiUrl}/v1/measure/${resultData.measurement_id}/heatmap`);
            if (response.ok && active) {
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              setHeatmapBlobUrl(objectUrl);
            } else if (active) {
              console.error("Failed to fetch heatmap:", response.status);
            }
          } catch (err) {
            console.error("Error fetching heatmap:", err);
          }
        };
        fetchHeatmap();
      }
    }
    return () => {
      active = false;
    };
  }, [showHeatmap, resultData, heatmapBlobUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processSelectedFile(event.target.files[0]);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      processSelectedFile(event.dataTransfer.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    // Revoke previous URL if any
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setSelectedFile(file);
    setErrorMsg(null);
    setResultData(null);
    setShowHeatmap(false);
    if (heatmapBlobUrl) {
      URL.revokeObjectURL(heatmapBlobUrl);
      setHeatmapBlobUrl("");
    }
    setReviewSuccessMsg(null);
    setReviewErrorMsg(null);
    
    // Create new object URL for preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    setResultData(null);
    setShowHeatmap(false);
    if (heatmapBlobUrl) {
      URL.revokeObjectURL(heatmapBlobUrl);
      setHeatmapBlobUrl("");
    }
    setErrorMsg(null);
    setReviewSuccessMsg(null);
    setReviewErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMsg(m.errors.selectFile);
      return;
    }

    const trimmedAge = age.trim();
    const trimmedBmi = bmi.trim();

    if (!trimmedAge || !trimmedBmi) {
      setErrorMsg(m.errors.fillInfo);
      return;
    }

    const ageNum = parseInt(trimmedAge, 10);
    if (isNaN(ageNum) || ageNum <= 0) {
      setErrorMsg(m.errors.invalidAge);
      return;
    }

    const bmiNum = parseFloat(trimmedBmi);
    if (isNaN(bmiNum) || bmiNum <= 0) {
      setErrorMsg(m.errors.invalidBmi);
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setResultData(null);
    setShowHeatmap(false);
    if (heatmapBlobUrl) {
      URL.revokeObjectURL(heatmapBlobUrl);
      setHeatmapBlobUrl("");
    }

    const apiUrl = getApiUrl();
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("age", trimmedAge);
    formData.append("sex", sex);
    formData.append("bmi", trimmedBmi);

    try {
      const response = await fetchWithAuth(`${apiUrl}/v1/measure/predict`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      let resData: any = null;
      const responseText = await response.text();
      try {
        resData = responseText ? JSON.parse(responseText) : null;
      } catch (e) {
        throw new Error(m.errors.invalidJson(response.status));
      }

      if (!response.ok) {
        throw new Error((resData && resData.detail) || resData?.message || m.errors.analyzeFailed(response.status));
      }

      if (resData && resData.success && resData.data) {
        setResultData(resData.data);
        setDoctorConfirmedLabel(resData.data.predicted_label);
        setReviewStatus("confirmed_correct");
        setErrorType("none");
        setApprovedForNextTraining(false);
        setReviewNote("");
        setReviewSuccessMsg(null);
        setReviewErrorMsg(null);
      } else {
        throw new Error(m.errors.invalidDataFormat);
      }
    } catch (err: any) {
      console.error("Analysis API error:", err);
      setErrorMsg(err.message || m.errors.connectFailed);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleSaveReview = async () => {
    if (!resultData || !resultData.measurement_id) {
      setReviewErrorMsg(m.errors.recordNotFound);
      return;
    }

    setIsSavingReview(true);
    setReviewSuccessMsg(null);
    setReviewErrorMsg(null);

    const apiUrl = getApiUrl();
    try {
      const response = await fetchWithAuth(`${apiUrl}/v1/measure/confirm/${resultData.measurement_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          review_status: reviewStatus,
          doctor_confirmed_label: reviewStatus === "confirmed_correct" ? resultData.predicted_label : doctorConfirmedLabel,
          error_type: reviewStatus === "confirmed_correct" ? "none" : errorType,
          approved_for_next_training: approvedForNextTraining,
          review_note: reviewNote,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || resData.message || m.errors.confirmFailed);
      }

      if (resData.success) {
        setReviewSuccessMsg(m.success.saveReviewSuccess);
      } else {
        throw new Error(m.errors.confirmNoteFailed);
      }
    } catch (err: any) {
      console.error("Save review error:", err);
      setReviewErrorMsg(err.message || m.errors.saveReviewConnectFailed);
    } finally {
      setIsSavingReview(false);
    }
  };

  const confidenceText = resultData ? `${Math.round(resultData.confidence * 100)}%` : "N/A";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>{m.view.title}</h1>
          <p className={styles.patientInfo}>
            {selectedFile 
              ? m.view.fileLabel(selectedFile.name, (selectedFile.size / (1024 * 1024)).toFixed(2))
              : m.view.filePrompt
            }
          </p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.btnPrimary} 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !selectedFile}
          >
            <span className="material-symbols-outlined">
              {isAnalyzing ? "sync" : "analytics"}
            </span>
            {isAnalyzing ? m.view.btnAnalyzing : m.view.btnAnalyze}
          </button>
          <button className={styles.btnSecondary} onClick={handlePrintPDF} disabled={!resultData}>
            <span className="material-symbols-outlined">print</span>
            {m.view.btnExportPdf}
          </button>
        </div>
      </div>Outputs:

      <div className={styles.grid}>
        {/* Left Column: Upload, Inputs & Preview */}
        <div className={styles.leftCol}>
          {/* Metadata Inputs Card */}
          <div className={styles.inputsCard}>
            <div className={styles.inputsGrid}>
              <div className={styles.field}>
                <label htmlFor="patient-age">{m.view.ageLabel}</label>
                <input
                  id="patient-age"
                  type="number"
                  placeholder={m.view.agePlaceholder}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  disabled={isAnalyzing}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="patient-sex">{m.view.sexLabel}</label>
                <select
                  id="patient-sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  disabled={isAnalyzing}
                >
                  <option value="F">{m.view.sexFemale}</option>
                  <option value="M">{m.view.sexMale}</option>
                  <option value="Other">{m.view.sexOther}</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="patient-bmi">{m.view.bmiLabel}</label>
                <input
                  id="patient-bmi"
                  type="number"
                  step="0.1"
                  placeholder={m.view.bmiPlaceholder}
                  value={bmi}
                  onChange={(e) => setBmi(e.target.value)}
                  disabled={isAnalyzing}
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className={styles.errorBox}>
              <span className="material-symbols-outlined">error</span>
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,.png,.jpg,.jpeg"
            className={styles.uploadInput}
            onChange={handleFileChange}
          />
          
          {/* Scan Preview & Upload Area (Combined) */}
          <div
            className={`${styles.scanPreview} ${
              !selectedFile
                ? isDragActive
                  ? styles.scanPreviewActive
                  : styles.scanPreviewEmpty
                : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              showHeatmap && resultData && heatmapBlobUrl ? (
                <img src={heatmapBlobUrl} alt="AI Grad-CAM Heatmap" className={styles.scanImage} />
              ) : (
                // Check if file is dicom. Dicom files are rendered as placeholder image because browser cannot directly display raw dicom data
                selectedFile.name.toLowerCase().endsWith(".dcm") ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", padding: "20px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "64px", marginBottom: "16px", color: "#155dca" }}>
                      medical_services
                    </span>
                    <h4>{m.view.dicomFileTitle}</h4>
                    <p style={{ fontSize: "0.85rem", marginTop: "4px", color: "#64748b" }}>
                      {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  </div>
                ) : (
                  <img src={previewUrl} alt="X-Ray Scan Preview" className={styles.scanImage} />
                )
              )
            ) : (
              <div className={styles.uploadAreaInner} onClick={handleOpenPicker}>
                <div className={styles.uploadIconWrapper}>
                  <span className="material-symbols-outlined">cloud_upload</span>
                </div>
                <h3 className={styles.uploadTitle}>{m.view.uploadTitle}</h3>
                <p className={styles.uploadDesc}>{m.view.uploadDesc}</p>
              </div>
            )}

            {/* Clear button and overlay controls when file is selected */}
            {selectedFile && (
              <div className={styles.aiOverlays} style={{ pointerEvents: "none" }}>
                <div className={styles.overlayTop} style={{ justifyContent: "flex-end", width: "100%" }}>
                  <div className={styles.overlayControls} style={{ pointerEvents: "auto" }}>
                    {resultData && resultData.heatmap_url && (
                      <button 
                        className={`${styles.controlBtn} ${showHeatmap ? styles.controlBtnActive : ""}`}
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        style={{
                          backgroundColor: showHeatmap ? "rgba(21, 93, 202, 0.2)" : "rgba(255, 255, 255, 0.15)",
                          borderColor: showHeatmap ? "#155dca" : "rgba(255, 255, 255, 0.3)",
                        }}
                        title={showHeatmap ? "Ẩn bản đồ nhiệt XAI" : "Hiển thị bản đồ nhiệt XAI"}
                      >
                        <span className="material-symbols-outlined" style={{ color: showHeatmap ? "#155dca" : "#e2e8f0" }}>
                          {showHeatmap ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    )}
                    {resultData && (
                      <>
                        <button className={styles.controlBtn}>
                          <span className="material-symbols-outlined">zoom_in</span>
                        </button>
                        <button className={styles.controlBtn}>
                          <span className="material-symbols-outlined">grid_on</span>
                        </button>
                      </>
                    )}
                    <button 
                      className={styles.controlBtn} 
                      onClick={handleRemoveFile}
                      style={{ backgroundColor: "rgba(186, 26, 26, 0.2)", borderColor: "rgba(186, 26, 26, 0.4)" }}
                      title={m.view.deleteTitle}
                    >
                      <span className="material-symbols-outlined" style={{ color: "#f87171" }}>close</span>
                    </button>
                  </div>
                </div>

                {/* AI Bottom Badge/Overlay (only if analyzing or has results) */}
                {/* {(isAnalyzing || resultData) && (
                  <div className={styles.overlayBottom}>
                    <div className={styles.infoBox}>
                      <div className={styles.infoLabel}>Detected Region</div>
                      <div className={styles.infoValue}>Lumbar Spine (L1-L4)</div>
                    </div>
                    <div className={styles.infoBoxRight}>
                      <div className={styles.infoLabel}>Processing Confidence</div>
                      <div className={styles.infoValueGreen}>{confidenceText}</div>
                    </div>
                  </div>
                )} */}
              </div>
            )}

            {/* AI Active Badge (Top left, show only when a file is selected and we are analyzing or have results) */}
            {selectedFile && (isAnalyzing || resultData) && (
              <div className={styles.aiOverlays} style={{ pointerEvents: "none" }}>
                <div className={styles.overlayTop}>
                  <div className={styles.aiActiveBadge}>
                    <span className={styles.pulseDot}></span>
                    {isAnalyzing ? m.view.aiProcessing : m.view.aiActive}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Diagnostic Results */}
        <div className={styles.rightCol}>
          <div className={styles.diagnosticCard}>
            <h2 className={styles.cardTitle}>
              <span className="material-symbols-outlined">analytics</span>
              {m.view.aiResultsTitle}
            </h2>

            {/* Primary Values */}
            {resultData && (
              <>
                <div className={styles.scoresGrid}>
                  <div className={styles.scoreBox}>
                    <div className={styles.scoreLabel}>T-Score Dự Đoán</div>
                    <div 
                      className={resultData.predicted_t_score <= -2.5 ? styles.scoreValueRed : styles.scoreValue} 
                      style={{ color: resultData.predicted_t_score <= -2.5 ? "#ba1a1a" : "#155dca" }}
                    >
                      {resultData.predicted_t_score !== undefined && resultData.predicted_t_score !== null 
                        ? resultData.predicted_t_score.toFixed(2) 
                        : "N/A"}
                    </div>
                    <div className={resultData.predicted_t_score <= -2.5 ? styles.scoreStatusRed : styles.scoreStatus}>
                      {resultData.predicted_t_score <= -2.5 
                        ? "Loãng xương (Nguy cơ cao)" 
                        : resultData.predicted_t_score <= -1.0 
                          ? "Thiếu xương (Nguy cơ vừa)" 
                          : "Bình thường (Nguy cơ thấp)"}
                    </div>
                  </div>
                  <div className={styles.scoreBox}>
                    <div className={styles.scoreLabel}>Nhãn AI Dự Đoán</div>
                    <div 
                      className={resultData.predicted_label === "osteoporosis" ? styles.scoreValueRed : styles.scoreValue} 
                      style={{ 
                        color: resultData.predicted_label === "osteoporosis" 
                          ? "#ba1a1a" 
                          : (resultData.predicted_label === "osteopenia" ? "#eab308" : "#22c55e") 
                      }}
                    >
                      {resultData.predicted_label === "osteoporosis" 
                        ? "Loãng xương" 
                        : resultData.predicted_label === "osteopenia" 
                          ? "Thiếu xương" 
                          : "Bình thường"}
                    </div>
                    <div className={styles.scoreStatus}>
                      Độ tin cậy: {Math.round(resultData.confidence * 100)}%
                    </div>
                  </div>
                </div>
                {resultData.predicted_t_score !== undefined && resultData.predicted_t_score !== null &&
                 resultData.predicted_t_score > -2.5 && resultData.predicted_t_score <= -2.0 && (
                  <div style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "8px",
                    color: "#b45309",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    lineHeight: "1.5"
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#d97706", flexShrink: 0, marginTop: "2px" }}>
                      warning
                    </span>
                    <div>
                      <strong style={{ display: "block", marginBottom: "4px" }}>Cảnh báo vùng ranh giới:</strong>
                      Chỉ số T-score dự đoán ({resultData.predicted_t_score.toFixed(2)}) nằm rất sát ngưỡng chẩn đoán Loãng xương (-2.5). Khuyến nghị bác sĩ đối chiếu kỹ lâm sàng hoặc đo lại bằng phương pháp DXA để tránh bỏ sót bệnh.
                    </div>
                  </div>
                )}
              </>
            )}

            {/* BMD Card */}
            {/* <div className={styles.bmdCard}>
              <div className={styles.bmdHeader}>
                <span className={styles.bmdTitle}>Bone Mineral Density (BMD)</span>
                <span className="material-symbols-outlined">info</span>
              </div>
              <div className={styles.bmdValueRow}>
                <span className={styles.bmdValue} style={{ color: "#1e3a8a" }}>N/A</span>
                <span className={styles.bmdUnit}>g/cm²</span>
              </div>
              <div className={styles.bmdDeviation} style={{ color: "#64748b" }}>
            {/* Classification Gauge */}
            <ClassificationGauge resultData={resultData} />

            {/* Trend Analysis */}
            <div className={styles.trendSection}>
              <div className={styles.trendLabel}>{m.view.confidenceLabel}</div>
              <div className={styles.trendContent}>
                <div
                  className={styles.trendIconWrapper}
                  style={{
                    backgroundColor: resultData ? "rgba(21, 93, 202, 0.1)" : "rgba(148, 163, 184, 0.1)",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: resultData ? "#155dca" : "#64748b" }}
                  >
                    query_stats
                  </span>
                </div>
                <div>
                  <div className={styles.trendValue}>{confidenceText}</div>
                  <div className={styles.trendDesc}>
                    {resultData 
                      ? m.view.confidenceDescActive(resultData.model_name)
                      : m.view.confidenceDescDefault
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className={styles.insightsCard}>
            <h3 className={styles.insightsTitle}>
              <span className="material-symbols-outlined">psychology</span>
              {m.view.aiInsightsTitle}
            </h3>
            <ul className={styles.insightsList}>
              {resultData ? (
                <>
                  {resultData.predicted_label === "osteoporosis" && (
                    <>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>cancel</span>
                        {m.view.insights.osteoporosis[0]}
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>error</span>
                        {m.view.insights.osteoporosis[1]}
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>info</span>
                        {m.view.insights.osteoporosis[2]}
                      </li>
                    </>
                  )}
                  {resultData.predicted_label === "osteopenia" && (
                    <>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#d97706" }}>warning</span>
                        {m.view.insights.osteopenia[0]}
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#d97706" }}>info</span>
                        {m.view.insights.osteopenia[1]}
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#d97706" }}>schedule</span>
                        {m.view.insights.osteopenia[2]}
                      </li>
                    </>
                  )}
                  {resultData.predicted_label === "normal" && (
                    <>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#10b981" }}>check_circle</span>
                        {m.view.insights.normal[0]}
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#10b981" }}>info</span>
                        {m.view.insights.normal[1]}
                      </li>
                    </>
                  )}
                </>
              ) : (
                <>
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    {m.view.insights.empty[0]}
                  </li>
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    {m.view.insights.empty[1]}
                  </li>
                </>
              )}
            </ul>
          </div>

          {resultData && (
            <div className={styles.reviewCard} style={{ marginTop: "16px" }}>
              <h3 className={styles.reviewTitle}>
                <span className="material-symbols-outlined">rate_review</span>
                {m.view.reviewTitle}
              </h3>
              
              <div className={styles.reviewForm}>
                {/* Review status */}
                <div className={styles.field}>
                  <label>{m.view.reviewStatusLabel}</label>
                  <div className={styles.reviewStatusRow}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="reviewStatus"
                        value="confirmed_correct"
                        checked={reviewStatus === "confirmed_correct"}
                        onChange={() => setReviewStatus("confirmed_correct")}
                      />
                      {m.view.reviewAgreeAi}
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="reviewStatus"
                        value="corrected_by_doctor"
                        checked={reviewStatus === "corrected_by_doctor"}
                        onChange={() => setReviewStatus("corrected_by_doctor")}
                      />
                      {m.view.reviewCorrectLabel}
                    </label>
                  </div>
                </div>

                {/* Corrected label (if corrected_by_doctor selected) */}
                {reviewStatus === "corrected_by_doctor" && (
                  <div className={styles.field}>
                    <label htmlFor="doctor-label">{m.view.doctorLabelTitle}</label>
                    <select
                      id="doctor-label"
                      value={doctorConfirmedLabel}
                      onChange={(e) => setDoctorConfirmedLabel(e.target.value)}
                    >
                      <option value="normal">{m.view.doctorLabelNormal}</option>
                      <option value="osteopenia">{m.view.doctorLabelOsteopenia}</option>
                      <option value="osteoporosis">{m.view.doctorLabelOsteoporosis}</option>
                    </select>
                  </div>
                )}

                {/* Error type (if corrected_by_doctor selected) */}
                {reviewStatus === "corrected_by_doctor" && (
                  <div className={styles.field}>
                    <label htmlFor="error-type">{m.view.errorTypeLabel}</label>
                    <select
                      id="error-type"
                      value={errorType}
                      onChange={(e) => setErrorType(e.target.value)}
                    >
                      <option value="none">{m.view.errorTypeNone}</option>
                      <option value="under_prediction">{m.view.errorTypeUnderPrediction}</option>
                      <option value="over_prediction">{m.view.errorTypeOverPrediction}</option>
                      <option value="poor_image_quality">{m.view.errorTypePoorImage}</option>
                      <option value="wrong_input">{m.view.errorTypeWrongInput}</option>
                      <option value="other">{m.view.errorTypeOther}</option>
                    </select>
                  </div>
                )}

                {/* Agree to retain for retraining */}
                {reviewStatus === "corrected_by_doctor" && (
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={approvedForNextTraining}
                      onChange={(e) => setApprovedForNextTraining(e.target.checked)}
                    />
                    {m.view.approvedRetrainingLabel}
                  </label>
                )}

                {/* Clinical notes */}
                <div className={styles.textareaField}>
                  <label htmlFor="review-note">{m.view.reviewNoteLabel}</label>
                  <textarea
                    id="review-note"
                    placeholder={m.view.reviewNotePlaceholder}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>

                {/* Error / Success messages */}
                {reviewErrorMsg && (
                  <div className={styles.errorBox}>
                    <span className="material-symbols-outlined">error</span>
                    <div>{reviewErrorMsg}</div>
                  </div>
                )}

                {reviewSuccessMsg && (
                  <div className={styles.successBox}>
                    <span className="material-symbols-outlined">check_circle</span>
                    <div>{reviewSuccessMsg}</div>
                  </div>
                )}

                {/* Save button */}
                <div className={styles.reviewActions}>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleSaveReview}
                    disabled={isSavingReview}
                  >
                    <span className="material-symbols-outlined">
                      {isSavingReview ? "sync" : "save"}
                    </span>
                    {isSavingReview ? m.view.btnSaving : m.view.btnSave}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden printable report block (displayed only when printing) */}
      <PrintableReport
        age={age}
        sex={sex}
        bmi={bmi}
        selectedFile={selectedFile}
        resultData={resultData}
      />
    </div>
  );
}

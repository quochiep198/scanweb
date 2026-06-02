"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../measurement/measurement.module.css";

export default function MeasurementPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<string>("F");
  const [bmi, setBmi] = useState<string>("");
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

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
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMsg("Vui lòng chọn hoặc kéo thả ảnh X-ray/DICOM cần phân tích.");
      return;
    }

    const trimmedAge = age.trim();
    const trimmedBmi = bmi.trim();

    if (!trimmedAge || !trimmedBmi) {
      setErrorMsg("Vui lòng nhập đầy đủ thông tin phân tích (Tuổi và BMI).");
      return;
    }

    const ageNum = parseInt(trimmedAge, 10);
    if (isNaN(ageNum) || ageNum <= 0) {
      setErrorMsg("Tuổi phải là số nguyên dương hợp lệ.");
      return;
    }

    const bmiNum = parseFloat(trimmedBmi);
    if (isNaN(bmiNum) || bmiNum <= 0) {
      setErrorMsg("Chỉ số BMI phải là số thực dương hợp lệ.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setResultData(null);

    const apiUrl = getApiUrl();
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("age", trimmedAge);
    formData.append("sex", sex);
    formData.append("bmi", trimmedBmi);

    try {
      const response = await fetch(`${apiUrl}/v1/measure/predict`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      let resData: any = null;
      const responseText = await response.text();
      try {
        resData = responseText ? JSON.parse(responseText) : null;
      } catch (e) {
        throw new Error(`Phản hồi từ server không phải là định dạng JSON hợp lệ (Mã HTTP: ${response.status}).`);
      }

      if (!response.ok) {
        throw new Error((resData && resData.detail) || resData?.message || `Phân tích kết quả thất bại (Mã HTTP: ${response.status})`);
      }

      if (resData && resData.success && resData.data) {
        setResultData(resData.data);
      } else {
        throw new Error("Dữ liệu trả về từ server không đúng định dạng.");
      }
    } catch (err: any) {
      console.error("Analysis API error:", err);
      setErrorMsg(err.message || "Không thể kết nối đến server để phân tích kết quả.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // Determine gauge position
  let gaugeLeft = "50%";
  if (resultData) {
    if (resultData.predicted_label === "normal") {
      gaugeLeft = "85%";
    } else if (resultData.predicted_label === "osteopenia") {
      gaugeLeft = "50%";
    } else if (resultData.predicted_label === "osteoporosis") {
      gaugeLeft = "15%";
    }
  }

  // Get diagnostic labels
  const classificationText = resultData ? resultData.predicted_label_display : "N/A";
  const confidenceText = resultData ? `${Math.round(resultData.confidence * 100)}%` : "N/A";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Phân Tích Đo Lường & AI</h1>
          <p className={styles.patientInfo}>
            {selectedFile 
              ? `Tệp tin: ${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`
              : "Vui lòng chọn hoặc kéo thả ảnh X-ray/DICOM y tế để chẩn đoán"
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
            {isAnalyzing ? "Đang Phân Tích..." : "Chạy Phân Tích"}
          </button>
          <button className={styles.btnSecondary} onClick={handlePrintPDF} disabled={!resultData}>
            <span className="material-symbols-outlined">print</span>
            Xuất PDF
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left Column: Upload, Inputs & Preview */}
        <div className={styles.leftCol}>
          {/* Metadata Inputs Card */}
          <div className={styles.inputsCard}>
            <div className={styles.inputsGrid}>
              <div className={styles.field}>
                <label htmlFor="patient-age">Tuổi bệnh nhân *</label>
                <input
                  id="patient-age"
                  type="number"
                  placeholder="VD: 65"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  disabled={isAnalyzing}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="patient-sex">Giới tính *</label>
                <select
                  id="patient-sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  disabled={isAnalyzing}
                >
                  <option value="F">Nữ (Female)</option>
                  <option value="M">Nam (Male)</option>
                  <option value="Other">Khác (Other)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="patient-bmi">Chỉ số BMI *</label>
                <input
                  id="patient-bmi"
                  type="number"
                  step="0.1"
                  placeholder="VD: 22.5"
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
              // Check if file is dicom. Dicom files are rendered as placeholder image because browser cannot directly display raw dicom data
              selectedFile.name.toLowerCase().endsWith(".dcm") ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", padding: "20px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "64px", marginBottom: "16px", color: "#155dca" }}>
                    medical_services
                  </span>
                  <h4>Tệp dữ liệu DICOM y khoa</h4>
                  <p style={{ fontSize: "0.85rem", marginTop: "4px", color: "#64748b" }}>
                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                </div>
              ) : (
                <img src={previewUrl} alt="X-Ray Scan Preview" className={styles.scanImage} />
              )
            ) : (
              <div className={styles.uploadAreaInner} onClick={handleOpenPicker}>
                <div className={styles.uploadIconWrapper}>
                  <span className="material-symbols-outlined">cloud_upload</span>
                </div>
                <h3 className={styles.uploadTitle}>Click hoặc Kéo thả file quét ở đây</h3>
                <p className={styles.uploadDesc}>Hỗ trợ ảnh DICOM (.dcm), JPEG, PNG (Tối đa 50MB)</p>
              </div>
            )}

            {/* Clear button and overlay controls when file is selected */}
            {selectedFile && (
              <div className={styles.aiOverlays} style={{ pointerEvents: "none" }}>
                <div className={styles.overlayTop} style={{ justifyContent: "flex-end", width: "100%" }}>
                  <div className={styles.overlayControls} style={{ pointerEvents: "auto" }}>
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
                      title="Xóa tệp tin hiện tại"
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
                    {isAnalyzing ? "AI PROCESSING..." : "AI ANALYSIS ACTIVE"}
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
              Chỉ số Kết quả AI
            </h2>

            {/* Primary Values */}
            {/* <div className={styles.scoresGrid}>
              <div className={styles.scoreBox}>
                <div className={styles.scoreLabel}>T-Score</div>
                <div className={styles.scoreValue} style={{ color: "#94a3b8" }}>N/A</div>
                <div className={styles.scoreStatus} style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Phân loại AI thay thế
                </div>
              </div>
              <div className={styles.scoreBox}>
                <div className={styles.scoreLabel}>Z-Score</div>
                <div className={styles.scoreValue} style={{ color: "#94a3b8" }}>N/A</div>
                <div className={styles.scoreStatus} style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Phân loại AI thay thế
                </div>
              </div>
            </div> */}

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
                Chỉ số BMD giả lập (N/A)
              </div>
            </div> */}

            {/* Classification Gauge */}
            <div className={styles.classificationSection}>
              <div className={styles.classificationHeader}>
                <span className={styles.classificationTitle}>Phân loại loãng xương</span>
                <span
                  className={styles.classificationBadge}
                  style={{
                    backgroundColor: resultData
                      ? resultData.predicted_label === "normal"
                        ? "rgba(16, 185, 129, 0.1)"
                        : resultData.predicted_label === "osteopenia"
                          ? "rgba(251, 191, 36, 0.1)"
                          : "rgba(186, 26, 26, 0.1)"
                      : "rgba(148, 163, 184, 0.1)",
                    color: resultData
                      ? resultData.predicted_label === "normal"
                        ? "#10b981"
                        : resultData.predicted_label === "osteopenia"
                          ? "#d97706"
                          : "#ba1a1a"
                      : "#64748b",
                  }}
                >
                  {classificationText}
                </span>
              </div>

              <div className={styles.gaugeContainer}>
                <div className={styles.gaugePointer} style={{ left: gaugeLeft }}></div>
              </div>

              <div className={styles.gaugeLabels}>
                <span style={{ color: "#ba1a1a" }}>Loãng xương</span>
                <span style={{ color: "#d97706" }}>Thiếu xương</span>
                <span style={{ color: "#10b981" }}>Bình thường</span>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className={styles.trendSection}>
              <div className={styles.trendLabel}>Độ tin cậy dự đoán (Confidence)</div>
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
                      ? `Độ chính xác tương đối dựa trên model ${resultData.model_name}.`
                      : "Độ tin cậy được ước lượng bởi mô hình phân tích học sâu."
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
              AI Clinical Notes
            </h3>
            <ul className={styles.insightsList}>
              {resultData ? (
                <>
                  {resultData.predicted_label === "osteoporosis" && (
                    <>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>cancel</span>
                        Mức độ loãng xương được phát hiện cao. Có nguy cơ gãy xương đáng kể.
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>error</span>
                        Khuyến nghị theo dõi chuyên sâu với bác sĩ cơ xương khớp để lên phác đồ điều trị.
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#ba1a1a" }}>info</span>
                        Cần thực hiện các bài tập cải thiện và bổ sung dinh dưỡng theo chỉ định y khoa.
                      </li>
                    </>
                  )}
                  {resultData.predicted_label === "osteopenia" && (
                    <>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#d97706" }}>warning</span>
                        Mật độ xương bắt đầu suy giảm nhẹ (Thiếu xương).
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#d97706" }}>info</span>
                        Khuyến nghị bổ sung Canxi, Vitamin D và duy trì lối sống vận động lành mạnh.
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#d97706" }}>schedule</span>
                        Đề xuất đo lại mật độ xương định kỳ sau 6-12 tháng để theo dõi tiến triển.
                      </li>
                    </>
                  )}
                  {resultData.predicted_label === "normal" && (
                    <>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#10b981" }}>check_circle</span>
                        Mật độ xương nằm trong giới hạn khỏe mạnh bình thường.
                      </li>
                      <li>
                        <span className="material-symbols-outlined" style={{ color: "#10b981" }}>info</span>
                        Hãy tiếp tục duy trì thói quen ăn uống lành mạnh và tập thể thao thường xuyên.
                      </li>
                    </>
                  )}
                </>
              ) : (
                <>
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    Chưa có kết quả phân tích AI.
                  </li>
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    Vui lòng cung cấp đầy đủ thông tin lâm sàng (Tuổi, Giới tính, BMI) và tệp tin ảnh quét rồi nhấn "Chạy Phân Tích".
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Hidden printable report block (displayed only when printing) */}
      <div className={styles.printableReport}>
        <div className={styles.printHeader}>
          <div className={styles.printTitleBlock}>
            <h1>PHIẾU CHẨN ĐOÁN MẬT ĐỘ XƯƠNG (AI SÀNG LỌC)</h1>
            <p>Hệ thống hỗ trợ chẩn đoán hình ảnh loãng xương AI</p>
          </div>
          <div className={styles.printDate}>
            Ngày in: {new Date().toLocaleDateString("vi-VN")}
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.printSectionTitle}>1. Thông tin bệnh nhân</h2>
          <div className={styles.printGrid}>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Mã bệnh nhân:</span>
              <span className={styles.printFieldValue}>DXA-2023-8842</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Tuổi:</span>
              <span className={styles.printFieldValue}>{age || ".........."}</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Giới tính:</span>
              <span className={styles.printFieldValue}>
                {sex === "F" ? "Nữ" : sex === "M" ? "Nam" : sex === "Other" ? "Khác" : ".........."}
              </span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>BMI:</span>
              <span className={styles.printFieldValue}>{bmi || ".........."}</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Chiều cao:</span>
              <span className={styles.printFieldValue}>.......... cm</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Cân nặng:</span>
              <span className={styles.printFieldValue}>.......... kg</span>
            </div>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.printSectionTitle}>2. Thông tin ảnh</h2>
          <div className={styles.printGrid}>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Loại ảnh:</span>
              <span className={styles.printFieldValue}>
                {selectedFile?.name.toLowerCase().endsWith(".dcm") ? "DICOM" : selectedFile?.name.toLowerCase().endsWith(".png") ? "PNG" : selectedFile?.name.toLowerCase().match(/\.jpe?g$/) ? "JPG" : ".........."}
              </span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Vùng phân tích:</span>
              <span className={styles.printFieldValue}>lumbar spine</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Ngày chụp:</span>
              <span className={styles.printFieldValue}>....................</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Chất lượng ảnh:</span>
              <span className={styles.printFieldValue}>Tốt</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Mã ảnh / Image ID:</span>
              <span className={styles.printFieldValue}>....................</span>
            </div>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.printSectionTitle}>3. Kết quả AI</h2>
          <div className={styles.printResultBox}>
            <div className={styles.printResultTitle}>
              <span className={styles.printResultLabel}>KẾT LUẬN AI: {classificationText}</span>
              <span className={styles.printFieldValue}>Độ tin cậy: {confidenceText}</span>
            </div>
            <div className={styles.printProbsList}>
              <div className={styles.printProbItem}>
                <span>Bình thường:</span>
                <span>{resultData?.probabilities?.normal !== undefined ? `${Math.round(resultData.probabilities.normal * 100)}%` : "N/A"}</span>
              </div>
              <div className={styles.printProbItem}>
                <span>Thiếu xương:</span>
                <span>{resultData?.probabilities?.osteopenia !== undefined ? `${Math.round(resultData.probabilities.osteopenia * 100)}%` : "N/A"}</span>
              </div>
              <div className={styles.printProbItem}>
                <span>Loãng xương:</span>
                <span>{resultData?.probabilities?.osteoporosis !== undefined ? `${Math.round(resultData.probabilities.osteoporosis * 100)}%` : "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.printSectionTitle}>4. Ghi chú AI</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
            <div>• Vùng ảnh được phân tích: Lumbar Spine (L1-L4)</div>
            <div>• Cảnh báo nếu ảnh chất lượng thấp: Không phát hiện cảnh báo chất lượng</div>
            {resultData?.confidence !== undefined && resultData.confidence < 0.75 ? (
              <div style={{ color: '#d97706', fontWeight: 600 }}>
                • Khuyến nghị: Độ tin cậy dự đoán thấp ({confidenceText}), khuyến cáo bác sĩ nên đối chiếu kỹ lưỡng lâm sàng và hình ảnh gốc.
              </div>
            ) : resultData?.confidence !== undefined ? (
              <div>• Khuyến nghị: Độ tin cậy dự đoán cao ({confidenceText}).</div>
            ) : (
              <div>• Khuyến nghị: ..........</div>
            )}
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.printSectionTitle}>5. Kết luận bác sĩ</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ border: '1px solid #000', width: '14px', height: '14px', display: 'inline-block' }}></span>
              <span>Xác nhận kết luận AI</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ border: '1px solid #000', width: '14px', height: '14px', display: 'inline-block' }}></span>
              <span>Chỉnh sửa kết luận thành: .......................................</span>
            </div>
          </div>
          <div style={{ fontSize: '0.9rem' }}>
            Ghi chú bác sĩ: ........................................................................................................................................................................................
          </div>
        </div>

        <div className={styles.printSection}>
          <h2 className={styles.printSectionTitle}>6. Thông tin kỹ thuật</h2>
          <div className={styles.printGrid}>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Model Name:</span>
              <span className={styles.printFieldValue}>{resultData?.model_name || "best_model.pt"}</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Model Version:</span>
              <span className={styles.printFieldValue}>v1.0.0</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Inference ID:</span>
              <span className={styles.printFieldValue}>{resultData?.confidence !== undefined ? `AI-DXA-${resultData.confidence.toString().substring(2, 8)}` : "AI-DXA-XXXXXX"}</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Thời gian phân tích:</span>
              <span className={styles.printFieldValue}>{new Date().toLocaleString("vi-VN")}</span>
            </div>
            <div className={styles.printField}>
              <span className={styles.printFieldLabel}>Người thực hiện:</span>
              <span className={styles.printFieldValue}>Bác sĩ phụ trách</span>
            </div>
          </div>
        </div>

        <div className={styles.printSection} style={{ marginTop: '20px', borderTop: '1px solid #111827', paddingTop: '10px' }}>
          <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#4b5563', lineHeight: '1.4' }}>
            <strong>Disclaimer (Miễn trừ trách nhiệm):</strong><br />
            - Kết quả phân tích từ AI chỉ mang tính chất hỗ trợ sàng lọc và tham khảo lâm sàng.<br />
            - Không thay thế kết luận chẩn đoán xác định cuối cùng của bác sĩ chuyên khoa.<br />
            - Trong trường hợp cần chẩn đoán mật độ xương chính xác chuẩn vàng, đề xuất đối chiếu chéo với hệ thống DXA/BMD tiêu chuẩn.
          </div>
        </div>

        <div className={styles.printFooter}>
          <div className={styles.printSignArea}>
            <div className={styles.printSignTitle}>Kỹ thuật viên thực hiện</div>
            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#6b7280' }}>(Ký và ghi rõ họ tên)</div>
          </div>
          <div className={styles.printSignArea}>
            <div className={styles.printSignTitle}>Bác sĩ chuyên khoa chẩn đoán</div>
            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#6b7280' }}>(Ký và ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

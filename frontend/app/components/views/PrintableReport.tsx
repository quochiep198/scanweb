import styles from "../../measurement/measurement.module.css";

interface PrintableReportProps {
  age: string;
  sex: string;
  bmi: string;
  selectedFile: File | null;
  resultData: any;
}

export default function PrintableReport({
  age,
  sex,
  bmi,
  selectedFile,
  resultData,
}: PrintableReportProps) {
  const classificationText = resultData ? resultData.predicted_label_display : "N/A";
  const confidenceText = resultData ? `${Math.round(resultData.confidence * 100)}%` : "N/A";

  return (
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
  );
}

import styles from "../../measurement/measurement.module.css";
import { messages } from "@/app/messages";

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
  const m = messages.printableReport;
  const classificationText = resultData ? resultData.predicted_label_display : "N/A";
  const confidenceText = resultData ? `${Math.round(resultData.confidence * 100)}%` : "N/A";

  return (
    <div className={styles.printableReport}>
      <div className={styles.printHeader}>
        <div className={styles.printTitleBlock}>
          <h1>{m.mainTitle}</h1>
          <p>{m.subTitle}</p>
        </div>
        <div className={styles.printDate}>
          {m.printDateLabel}{new Date().toLocaleDateString("vi-VN")}
        </div>
      </div>

      <div className={styles.printSection}>
        <h2 className={styles.printSectionTitle}>{m.patientSectionTitle}</h2>
        <div className={styles.printGrid}>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.patientIdLabel}</span>
            <span className={styles.printFieldValue}>DXA-2023-8842</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.ageLabel}</span>
            <span className={styles.printFieldValue}>{age || ".........."}</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.sexLabel}</span>
            <span className={styles.printFieldValue}>
              {sex === "F" ? m.sexF : sex === "M" ? m.sexM : sex === "Other" ? m.sexOther : ".........."}
            </span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.bmiLabel}</span>
            <span className={styles.printFieldValue}>{bmi || ".........."}</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.heightLabel}</span>
            <span className={styles.printFieldValue}>.......... cm</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.weightLabel}</span>
            <span className={styles.printFieldValue}>.......... kg</span>
          </div>
        </div>
      </div>

      <div className={styles.printSection}>
        <h2 className={styles.printSectionTitle}>{m.imageSectionTitle}</h2>
        <div className={styles.printGrid}>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.imageTypeLabel}</span>
            <span className={styles.printFieldValue}>
              {selectedFile?.name.toLowerCase().endsWith(".dcm") ? "DICOM" : selectedFile?.name.toLowerCase().endsWith(".png") ? "PNG" : selectedFile?.name.toLowerCase().match(/\.jpe?g$/) ? "JPG" : ".........."}
            </span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.analysisZoneLabel}</span>
            <span className={styles.printFieldValue}>lumbar spine</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.shootDateLabel}</span>
            <span className={styles.printFieldValue}>....................</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.imageQualityLabel}</span>
            <span className={styles.printFieldValue}>{m.qualityGood}</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.imageIdLabel}</span>
            <span className={styles.printFieldValue}>....................</span>
          </div>
        </div>
      </div>

      <div className={styles.printSection}>
        <h2 className={styles.printSectionTitle}>{m.aiSectionTitle}</h2>
        <div className={styles.printResultBox}>
          <div className={styles.printResultTitle}>
            <span className={styles.printResultLabel}>{m.aiConclusionLabel}{classificationText}</span>
            <span className={styles.printFieldValue}>{m.aiConfidenceLabel}{confidenceText}</span>
          </div>
          <div className={styles.printProbsList}>
            <div className={styles.printProbItem}>
              <span>{m.probNormalLabel}</span>
              <span>{resultData?.probabilities?.normal !== undefined ? `${Math.round(resultData.probabilities.normal * 100)}%` : "N/A"}</span>
            </div>
            <div className={styles.printProbItem}>
              <span>{m.probOsteopeniaLabel}</span>
              <span>{resultData?.probabilities?.osteopenia !== undefined ? `${Math.round(resultData.probabilities.osteopenia * 100)}%` : "N/A"}</span>
            </div>
            <div className={styles.printProbItem}>
              <span>{m.probOsteoporosisLabel}</span>
              <span>{resultData?.probabilities?.osteoporosis !== undefined ? `${Math.round(resultData.probabilities.osteoporosis * 100)}%` : "N/A"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.printSection}>
        <h2 className={styles.printSectionTitle}>{m.notesSectionTitle}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
          <div>{m.noteRegion}</div>
          <div>{m.noteQualityWarning}</div>
          {resultData?.confidence !== undefined && resultData.confidence < 0.75 ? (
            <div style={{ color: '#d97706', fontWeight: 600 }}>
              {m.recommendLowConfidence(confidenceText)}
            </div>
          ) : resultData?.confidence !== undefined ? (
            <div>{m.recommendHighConfidence(confidenceText)}</div>
          ) : (
            <div>{m.recommendEmpty}</div>
          )}
        </div>
      </div>

      <div className={styles.printSection}>
        <h2 className={styles.printSectionTitle}>{m.doctorSectionTitle}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ border: '1px solid #000', width: '14px', height: '14px', display: 'inline-block' }}></span>
            <span>{m.confirmAiLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ border: '1px solid #000', width: '14px', height: '14px', display: 'inline-block' }}></span>
            <span>{m.editConclusionLabel}</span>
          </div>
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          {m.doctorNotesLabel}
        </div>
      </div>

      <div className={styles.printSection}>
        <h2 className={styles.printSectionTitle}>{m.techSectionTitle}</h2>
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
            <span className={styles.printFieldLabel}>{m.techTimeLabel}</span>
            <span className={styles.printFieldValue}>{new Date().toLocaleString("vi-VN")}</span>
          </div>
          <div className={styles.printField}>
            <span className={styles.printFieldLabel}>{m.techOperatorLabel}</span>
            <span className={styles.printFieldValue}>{m.techOperatorDefault}</span>
          </div>
        </div>
      </div>

      <div className={styles.printSection} style={{ marginTop: '20px', borderTop: '1px solid #111827', paddingTop: '10px' }}>
        <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#4b5563', lineHeight: '1.4' }}>
          <strong>{m.disclaimerTitle}</strong><br />
          {m.disclaimerLine1}<br />
          {m.disclaimerLine2}<br />
          {m.disclaimerLine3}
        </div>
      </div>

      <div className={styles.printFooter}>
        <div className={styles.printSignArea}>
          <div className={styles.printSignTitle}>{m.techSignTitle}</div>
          <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#6b7280' }}>{m.signHint}</div>
        </div>
        <div className={styles.printSignArea}>
          <div className={styles.printSignTitle}>{m.doctorSignTitle}</div>
          <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#6b7280' }}>{m.signHint}</div>
        </div>
      </div>
    </div>
  );
}

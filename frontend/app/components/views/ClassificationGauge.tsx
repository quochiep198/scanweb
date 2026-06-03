import styles from "../../measurement/measurement.module.css";
import { messages } from "@/app/messages";

interface ClassificationGaugeProps {
  resultData: any;
}

export default function ClassificationGauge({ resultData }: ClassificationGaugeProps) {
  const m = messages.classificationGauge;

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

  return (
    <div className={styles.classificationSection}>
      <div className={styles.classificationHeader}>
        <span className={styles.classificationTitle}>{m.title}</span>
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
        <span style={{ color: "#ba1a1a" }}>{m.osteoporosis}</span>
        <span style={{ color: "#d97706" }}>{m.osteopenia}</span>
        <span style={{ color: "#10b981" }}>{m.normal}</span>
      </div>
    </div>
  );
}

"use client";

import styles from "../../measurement/measurement.module.css";

export default function MeasurementPage() {
  return (
    <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.pageTitle}>Phân Tích</h1>
              <p className={styles.patientInfo}>Bệnh Nhân: DXA-2023-8842 • Jane Doe</p>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.btnPrimary}>
                <span className="material-symbols-outlined">save</span>
                Phân Tích
              </button>
              <button className={styles.btnSecondary}>
                <span className="material-symbols-outlined">print</span>
                Xuất PDF
              </button>
              <button className={styles.btnPrimary}>
                <span className="material-symbols-outlined">save</span>
                Lưu File
              </button>
            </div>
          </div>

          <div className={styles.grid}>
            {/* Left Column: Upload & Preview */}
            <div className={styles.leftCol}>
              {/* Upload Area */}
              <div className={styles.uploadArea} onClick={() => alert('Opening file explorer...')}>
                <div className={styles.uploadIconWrapper}>
                  <span className="material-symbols-outlined">cloud_upload</span>
                </div>
                <h3 className={styles.uploadTitle}>Click or Drag DXA Scan</h3>
                <p className={styles.uploadDesc}>DICOM, JPEG, or PNG formats supported (Max 50MB)</p>
              </div>

              {/* Scan Preview Window */}
              <div className={styles.scanPreview}>
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqMmTgqMupUcKwkAWFtLwsH5Zm01XyIrMOnZF4G1OcTIXDmQ8_K-88wTJRcyjHY49Q-NswLf50xPg6wZnfXZrEnNBta8z9mXpKhgZudrEKkteEP6c2bMZoe-RrTTw7GlLNiyJ8vw3wnmpjpCRr8cO0LmSP2eTEyvswAc69qkLvAMwrZTtiFSiXDR7DOj1ITp15Kp80Zlw_gt4cU0QqSWE2rB_WKuFuWJnBEAQEiJy282xjbB9BnzD24U0mJrU5X9nPw-wSK-BLCLA-" 
                  alt="DXA Lumbar Spine Scan" 
                  className={styles.scanImage}
                />
                
                {/* AI Overlays */}
                <div className={styles.aiOverlays}>
                  <div className={styles.overlayTop}>
                    <div className={styles.aiActiveBadge}>
                      <span className={styles.pulseDot}></span>
                      AI ANALYSIS ACTIVE
                    </div>
                    <div className={styles.overlayControls}>
                      <button className={styles.controlBtn}><span className="material-symbols-outlined">zoom_in</span></button>
                      <button className={styles.controlBtn}><span className="material-symbols-outlined">grid_on</span></button>
                    </div>
                  </div>
                  
                  <div className={styles.overlayBottom}>
                    <div className={styles.infoBox}>
                      <div className={styles.infoLabel}>Detected Region</div>
                      <div className={styles.infoValue}>Lumbar Spine (L1-L4)</div>
                    </div>
                    <div className={styles.infoBoxRight}>
                      <div className={styles.infoLabel}>Processing Confidence</div>
                      <div className={styles.infoValueGreen}>99.4%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: AI Diagnostic Results */}
            <div className={styles.rightCol}>
              <div className={styles.diagnosticCard}>
                <h2 className={styles.cardTitle}>
                  <span className="material-symbols-outlined">analytics</span>
                  Chỉ số
                </h2>

                {/* Primary Values */}
                <div className={styles.scoresGrid}>
                  <div className={styles.scoreBox}>
                    <div className={styles.scoreLabel}>T-Score</div>
                    <div className={styles.scoreValueRed}>-2.8</div>
                    <div className={styles.scoreStatusRed}>Low Bone Mass</div>
                  </div>
                  <div className={styles.scoreBox}>
                    <div className={styles.scoreLabel}>Z-Score</div>
                    <div className={styles.scoreValue}>-1.2</div>
                    <div className={styles.scoreStatus}>Within normal range</div>
                  </div>
                </div>

                {/* BMD Card */}
                <div className={styles.bmdCard}>
                  <div className={styles.bmdHeader}>
                    <span className={styles.bmdTitle}>Bone Mineral Density (BMD)</span>
                    <span className="material-symbols-outlined">info</span>
                  </div>
                  <div className={styles.bmdValueRow}>
                    <span className={styles.bmdValue}>0.842</span>
                    <span className={styles.bmdUnit}>g/cm²</span>
                  </div>
                  <div className={styles.bmdDeviation}>
                    Deviation from mean: -14.2%
                  </div>
                </div>

                {/* Classification Gauge */}
                <div className={styles.classificationSection}>
                  <div className={styles.classificationHeader}>
                    <span className={styles.classificationTitle}>Classification</span>
                    <span className={styles.classificationBadge}>Osteoporosis</span>
                  </div>
                  
                  <div className={styles.gaugeContainer}>
                    <div className={styles.gaugePointer} style={{ left: '15%' }}></div>
                  </div>
                  
                  <div className={styles.gaugeLabels}>
                    <span>Osteoporosis</span>
                    <span>Osteopenia</span>
                    <span>Normal</span>
                  </div>
                </div>

                {/* Trend Analysis */}
                <div className={styles.trendSection}>
                  <div className={styles.trendLabel}>Comparison with previous (Jan 2022)</div>
                  <div className={styles.trendContent}>
                    <div className={styles.trendIconWrapper}>
                      <span className="material-symbols-outlined">trending_down</span>
                    </div>
                    <div>
                      <div className={styles.trendValue}>-0.15 T-Score Decrease</div>
                      <div className={styles.trendDesc}>Significant decline in lumbar density observed.</div>
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
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    Osteoporotic levels detected at L2 and L3 vertebral bodies.
                  </li>
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    High fracture risk indicated based on current T-score and patient age.
                  </li>
                  <li>
                    <span className="material-symbols-outlined">check_circle</span>
                    Recommended clinical follow-up for medication management.
                  </li>
                </ul>
              </div>
            </div>
          </div>
    </div>
  );
}

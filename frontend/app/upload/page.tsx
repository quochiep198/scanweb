"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { DashboardShell } from "@/components/layouts/DashboardShell";

import styles from "./upload.module.css";

type UploadStatus = "queued" | "uploading" | "success" | "error";
type ScanRegion = "Cột sống thắt lưng" | "Xương đùi" | "Toàn thân";
type DiagnosisLabel = "Bình thường" | "Thiếu xương" | "Lở xương";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  patientId: string;
  scanRegion: ScanRegion;
  diagnosisLabel: DiagnosisLabel;
  progress: number;
  status: UploadStatus;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const acceptedTypes = ".dcm,.png,.jpg,.jpeg";

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.round(size / 1024)} KB`;
}

function createUploadItem(file: File): UploadItem {
  const isPreviewable = file.type.startsWith("image/");
  return {
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: isPreviewable ? URL.createObjectURL(file) : null,
    patientId: "",
    scanRegion: "Cột sống thắt lưng",
    diagnosisLabel: "Bình thường",
    progress: 0,
    status: "queued",
  };
}

function getStatusText(item: UploadItem) {
  if (item.status === "success") {
    return "Hoàn tất tải lên";
  }

  if (item.status === "error") {
    return "Tệp vượt quá giới hạn 50MB";
  }

  if (item.status === "uploading") {
    return `Đang tải lên (${item.progress}%)`;
  }

  return "Cho xử lý";
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [augmentation, setAugmentation] = useState(false);
  const [crossValidation, setCrossValidation] = useState(true);
  const [selectedModel, setSelectedModel] = useState("OsteoScan v2.4 (Phan doan xuong)");

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setShowToast(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [showToast]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  const handleOpenPicker = () => {
    inputRef.current?.click();
  };

  const addFiles = (fileList: FileList | File[]) => {
    const nextItems = Array.from(fileList).map(createUploadItem);
    if (nextItems.length === 0) {
      return;
    }

    setItems((current) => [...current, ...nextItems]);
    setShowToast(true);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) {
      return;
    }

    addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    addFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleRemove = (id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const handleClearAll = () => {
    setItems((current) => {
      current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
  };

  const updateItem = <K extends keyof UploadItem>(id: string, key: K, value: UploadItem[K]) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        return { ...item, [key]: value };
      })
    );
  };

  const simulateUpload = async () => {
    const queuedIds = items
      .filter((item) => item.status === "queued" || item.status === "error")
      .map((item) => item.id);

    for (const id of queuedIds) {
      const currentItem = items.find((item) => item.id === id);
      if (!currentItem) {
        continue;
      }

      if (currentItem.file.size > MAX_FILE_SIZE) {
        updateItem(id, "status", "error");
        updateItem(id, "progress", 0);
        continue;
      }

      updateItem(id, "status", "uploading");
      updateItem(id, "progress", 12);

      await new Promise<void>((resolve) => {
        let progress = 12;
        const timer = window.setInterval(() => {
          progress = Math.min(progress + 13, 92);
          updateItem(id, "progress", progress);
        }, 120);

        window.setTimeout(() => {
          window.clearInterval(timer);
          updateItem(id, "progress", 100);
          updateItem(id, "status", "success");
          resolve();
        }, 820);
      });
    }
  };

  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const readyCount = items.filter((item) => item.status === "success").length;
  const unlabeledCount = items.filter((item) => !item.patientId.trim()).length;
  const readiness = items.length === 0 ? 0 : Math.round((readyCount / items.length) * 100);

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className={styles.page}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Quản lý tải lên & Huấn luyện AI</h1>
              <p className={styles.description}>
                Cung cấp dữ liệu làm sàng chất lượng cao để cải thiện độ chính xác của mô hình
                OsteoScan. Giai đoạn này chỉ dùng UI, toàn bộ trạng thái tải lên được mô phỏng trên
                client.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button type="button" className={styles.ghostButton}>
                <span className="material-symbols-outlined">history</span>
                Lịch sử huấn luyện
              </button>
              <button type="button" className={styles.primaryButton} onClick={simulateUpload}>
                <span className="material-symbols-outlined">model_training</span>
                Bắt đầu xử lý
              </button>
            </div>
          </header>

          <div className={styles.grid}>
            <div className={styles.mainColumn}>
              <section
                className={`${styles.uploadZone} ${isDragActive ? styles.uploadZoneActive : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className={styles.uploadIcon}>
                  <span className="material-symbols-outlined" style={{ fontSize: "44px" }}>
                    cloud_upload
                  </span>
                </div>
                <h2 className={styles.uploadHeading}>
                  kéo thả tệp tin vào đây hoặc{" "}
                  <button type="button" onClick={handleOpenPicker}>
                    Chọn từ máy tính
                  </button>
                </h2>
                <p className={styles.uploadCaption}>
                  Hỗ trợ định dạng DICOM (.dcm), PNG, JPG. ích thước tối đa mỗi tệp: 50MB. Đảm bảo
                  dữ liệu đã được ẩn danh theo quy định HIPAA/GDPR.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={acceptedTypes}
                  className={styles.fileInput}
                  onChange={handleInputChange}
                />
              </section>

              <section className={styles.queueCard}>
                <div className={styles.queueHeader}>
                  <h3 className={styles.queueTitle}>Hàng đợi tải lên ({items.length} tệp)</h3>
                  <button type="button" className={styles.clearButton} onClick={handleClearAll}>
                    Xóa tất cả
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className={styles.queueEmpty}>
                    Chưa có tệp nào trong hàng đợi. Chọn tệp để xem giao diện upload.
                  </div>
                ) : (
                  <div className={styles.queueList}>
                    {items.map((item) => {
                      const extension = item.file.name.split(".").pop()?.toUpperCase() || "FILE";
                      const statusClass =
                        item.status === "success"
                          ? styles.statusSuccess
                          : item.status === "error"
                            ? styles.statusError
                            : "";

                      return (
                        <article key={item.id} className={styles.queueItem}>
                          <div className={styles.itemTop}>
                            <div className={styles.thumb}>
                              {item.previewUrl ? (
                                <img src={item.previewUrl} alt={item.file.name} />
                              ) : (
                                <span className={styles.thumbBadge}>{extension}</span>
                              )}
                            </div>

                            <div>
                              <h4 className={styles.itemName}>{item.file.name}</h4>
                              <p className={styles.itemMeta}>
                                {formatFileSize(item.file.size)} {" - "}
                                <span className={statusClass}>{getStatusText(item)}</span>
                              </p>
                              <div className={styles.progressTrack} style={{ marginTop: "14px" }}>
                                <div
                                  className={styles.progressFill}
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => handleRemove(item.id)}
                              aria-label={`Xoa ${item.file.name}`}
                            >
                              <span className="material-symbols-outlined">
                                {item.status === "uploading" ? "close" : "delete"}
                              </span>
                            </button>
                          </div>

                          <div className={styles.metadataGrid}>
                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-patient`}>ID bệnh nhân</label>
                              <input
                                id={`${item.id}-patient`}
                                type="text"
                                value={item.patientId}
                                placeholder="P-98321"
                                onChange={(event) =>
                                  updateItem(item.id, "patientId", event.target.value)
                                }
                              />
                            </div>

                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-region`}>Vùng quét</label>
                              <select
                                id={`${item.id}-region`}
                                value={item.scanRegion}
                                onChange={(event) =>
                                  updateItem(item.id, "scanRegion", event.target.value as ScanRegion)
                                }
                              >
                                <option value="Cot song that lung">ột sống thắt lưng</option>
                                <option value="Xuong dui">Xương đùi</option>
                                <option value="Toan than">Toàn thân</option>
                              </select>
                            </div>

                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-diagnosis`}>Nhãn chẩn đoán</label>
                              <select
                                id={`${item.id}-diagnosis`}
                                value={item.diagnosisLabel}
                                onChange={(event) =>
                                  updateItem(
                                    item.id,
                                    "diagnosisLabel",
                                    event.target.value as DiagnosisLabel
                                  )
                                }
                              >
                                <option value="Binh thuong">Bình thường</option>
                                <option value="Thieu xuong">Thiếu xương</option>
                                <option value="Loang xuong">Lở xương</option>
                              </select>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <button type="button" className={styles.addMore} onClick={handleOpenPicker}>
                  <span className="material-symbols-outlined" style={{ verticalAlign: "middle" }}>
                    add_circle
                  </span>{" "}
                  Thêm tệp khác
                </button>
              </section>
            </div>

            <aside className={styles.sidebarColumn}>
              <section className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>Tong quan Dataset</h3>

                <div className={styles.overviewList}>
                  <div className={styles.overviewRow}>
                    <span>Tổng số tệp</span>
                    <span className={styles.overviewValue}>{items.length}</span>
                  </div>
                  <div className={styles.overviewRow}>
                    <span>Đã định danh</span>
                    <span className={styles.overviewValue}>
                      {items.length - unlabeledCount} / {items.length}
                    </span>
                  </div>
                  <div className={styles.overviewRow}>
                    <span>Chưa gắn nhãn</span>
                    <span className={styles.overviewValue}>{unlabeledCount}</span>
                  </div>
                  <div className={styles.overviewRow}>
                    <span>Dung lượng tổng</span>
                    <span className={styles.overviewValue}>{formatFileSize(totalSize)}</span>
                  </div>
                </div>

                <div className={styles.progressHeader}>
                  <span>Độ sẵn sàng dataset</span>
                  <span>{readiness}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${readiness}%` }} />
                </div>
                <p className={styles.progressHint}>
                  Cần gắn nhãn cho tất cả các tệp trước khi bắt đầu huấn luyện. Tiến độ hiện tại chỉ
                  phản ánh trạng thái UI.
                </p>

                <button type="button" className={styles.trainButton}>
                  <span className="material-symbols-outlined" style={{ verticalAlign: "middle" }}>
                    play_circle
                  </span>{" "}
                  Huấn luyện ngay
                </button>
                <p className={styles.eta}>
                  Thời gian xử lý dự kiến: <strong>~15 phút</strong>
                </p>
              </section>

              <section className={styles.configCard}>
                <p className={styles.configLabel}>Cấu hình mô hình</p>

                <div className={styles.configField}>
                  <label htmlFor="model-select">Mô hình cơ sở</label>
                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                  >
                    <option>OsteoScan v2.4 (Phân đoạn xương)</option>
                    <option>BoneDensity-Net (Phân loại T-score)</option>
                    <option>Fracture-Check v1.0 (Phát hiện gãy xương)</option>
                  </select>
                </div>

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={augmentation}
                    onChange={(event) => setAugmentation(event.target.checked)}
                  />
                  <span>Sử dụng Data Augmentation</span>
                </label>

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={crossValidation}
                    onChange={(event) => setCrossValidation(event.target.checked)}
                  />
                  <span>Tự động hóa Cross-validation</span>
                </label>
              </section>
            </aside>
          </div>

          {showToast ? (
            <div className={styles.toast}>
              <span className="material-symbols-outlined" style={{ color: "#61d895" }}>
                check_circle
              </span>
              <span>Đã thêm tệp vào hàng đợi thành công.</span>
            </div>
          ) : null}
        </div>
      </DashboardShell>
    </ProtectedRoute>
  );
}

"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { DashboardShell } from "@/components/layouts/DashboardShell";
import { useAuth } from "@/app/context/AuthContext";

import styles from "./upload.module.css";

type UploadStatus = "queued" | "uploading" | "success" | "error";
type ScanRegion = string;
type DiagnosisLabel = string;

const DEFAULT_SCAN_ZONES = [
  { name: "Cột sống thắt lưng", value: "lumbar_spine" },
  { name: "Xương đùi", value: "femoral_neck" },
  { name: "Toàn thân", value: "other" },
];

const DEFAULT_DIAGNOSTIC_LABELS = [
  { name: "Bình thường", value: "normal" },
  { name: "Thiếu xương", value: "osteopenia" },
  { name: "Lở xương", value: "osteoporosis" },
];

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string | null;
  progress: number;
  status: UploadStatus;
  errorMessage?: string;

  // patients table
  anonymousCode: string;
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  bmi: string;

  // xray_images table
  xrayDate: string;
  viewType: string;
  bodyPart: string;
  scannerVendor: string;
  pixelSpacing: string;
  imageQuality: string;

  // osteoporosis_labels table
  label: string;
  tScore: string;
  bmd: string;
  dxaSite: string;
  dxaDate: string;
  labelSource: string;
  datasetSplit: string;
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
  const anonymousCode = file.name.split(/[._-]/)[0] || "";
  return {
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: isPreviewable ? URL.createObjectURL(file) : null,
    progress: 0,
    status: "queued",
    errorMessage: "",

    // patients
    anonymousCode: anonymousCode,
    age: "",
    sex: "M",
    heightCm: "",
    weightKg: "",
    bmi: "",

    // xray_images
    xrayDate: new Date().toISOString().split("T")[0],
    viewType: "AP",
    bodyPart: "lumbar_spine",
    scannerVendor: "",
    pixelSpacing: "",
    imageQuality: "good",

    // osteoporosis_labels
    label: "normal",
    tScore: "",
    bmd: "",
    dxaSite: "lumbar_spine",
    dxaDate: new Date().toISOString().split("T")[0],
    labelSource: "DXA",
    datasetSplit: "train",
  };
}

function getStatusText(item: UploadItem) {
  if (item.status === "success") {
    return "Hoàn tất tải lên";
  }

  if (item.status === "error") {
    return item.errorMessage || "Lỗi xử lý";
  }

  if (item.status === "uploading") {
    return `Đang tải lên (${item.progress}%)`;
  }

  return "Cho xử lý";
}

const uploadWithProgress = (
  url: string,
  token: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          resolve(xhr.responseText);
        }
      } else {
        try {
          reject(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };
    
    xhr.onerror = () => {
      reject(new Error("Network error"));
    };
    
    xhr.send(formData);
  });
};

export default function UploadPage() {
  const { accessToken } = useAuth();
  const [scanZones, setScanZones] = useState<{ name: string; value: string }[]>(DEFAULT_SCAN_ZONES);
  const [diagnosticLabels, setDiagnosticLabels] = useState<{ name: string; value: string }[]>(DEFAULT_DIAGNOSTIC_LABELS);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [augmentation, setAugmentation] = useState(false);
  const [crossValidation, setCrossValidation] = useState(true);
  const [selectedModel, setSelectedModel] = useState("OsteoScan v2.4 (Phan doan xuong)");
  const [resultPopup, setResultPopup] = useState<{
    isOpen: boolean;
    status: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const fetchOptions = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const response = await fetch(`${API_URL}/v1/upload/options`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.scan_zones && data.scan_zones.length > 0) {
            setScanZones(data.scan_zones);
          }
          if (data.diagnostic_labels && data.diagnostic_labels.length > 0) {
            setDiagnosticLabels(data.diagnostic_labels);
          }
        }
      } catch (error) {
        console.error("Error fetching upload options:", error);
      }
    };

    fetchOptions();
  }, [accessToken]);

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

  const handleStartProcessing = async () => {
    const queuedItems = items.filter((item) => item.status === "queued" || item.status === "error");
    if (queuedItems.length === 0) return;

    let hasError = false;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    for (const item of queuedItems) {
      if (item.file.size > MAX_FILE_SIZE) {
        updateItem(item.id, "status", "error");
        updateItem(item.id, "errorMessage", "Tệp vượt quá giới hạn 50MB");
        updateItem(item.id, "progress", 0);
        hasError = true;
        continue;
      }

      updateItem(item.id, "status", "uploading");
      updateItem(item.id, "progress", 0);
      updateItem(item.id, "errorMessage", "");

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("anonymous_code", item.anonymousCode);
        formData.append("age", item.age);
        formData.append("sex", item.sex);
        formData.append("height_cm", item.heightCm);
        formData.append("weight_kg", item.weightKg);
        formData.append("bmi", item.bmi);
        formData.append("xray_date", item.xrayDate);
        formData.append("view_type", item.viewType);
        formData.append("body_part", item.bodyPart);
        formData.append("scanner_vendor", item.scannerVendor);
        formData.append("pixel_spacing", item.pixelSpacing);
        formData.append("image_quality", item.imageQuality);
        formData.append("label", item.label);
        formData.append("t_score", item.tScore);
        formData.append("bmd", item.bmd);
        formData.append("dxa_site", item.dxaSite);
        formData.append("dxa_date", item.dxaDate);
        formData.append("label_source", item.labelSource);
        formData.append("dataset_split", item.datasetSplit);

        await uploadWithProgress(
          `${API_URL}/v1/upload`,
          accessToken || "",
          formData,
          (progress) => {
            updateItem(item.id, "progress", progress);
          }
        );

        updateItem(item.id, "status", "success");
        updateItem(item.id, "progress", 100);
      } catch (error: any) {
        console.error("Upload error for item", item.id, error);
        updateItem(item.id, "status", "error");
        updateItem(item.id, "errorMessage", error.detail || error.message || "Đăng ký thất bại");
        updateItem(item.id, "progress", 0);
        hasError = true;
      }
    }

    if (hasError) {
      setResultPopup({
        isOpen: true,
        status: "error",
        message: "Đăng ký thất bại",
      });
    } else {
      setResultPopup({
        isOpen: true,
        status: "success",
        message: "Đã đăng ký dữ liệu thành công",
      });
    }
  };

  const handleTrainNow = async () => {
    if (!accessToken) {
      setResultPopup({
        isOpen: true,
        status: "error",
        message: "Bạn cần đăng nhập để thực hiện huấn luyện.",
      });
      return;
    }

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/v1/training/metadata`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch training metadata");
      }

      const resData = await response.json();
      setResultPopup({
        isOpen: true,
        status: "success",
        message: `Lấy dữ liệu huấn luyện thành công! Đã tải ${resData.count} bản ghi từ SQL metadata.`,
      });
      console.log("Training metadata loaded:", resData.data);
    } catch (error) {
      console.error("Error fetching training metadata:", error);
      setResultPopup({
        isOpen: true,
        status: "error",
        message: "Không thể kết nối đến server để lấy dữ liệu metadata.",
      });
    }
  };

  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const readyCount = items.filter((item) => item.status === "success").length;
  const unlabeledCount = items.filter((item) => !item.anonymousCode.trim()).length;
  const readiness = items.length === 0 ? 0 : Math.round((readyCount / items.length) * 100);

  return (
    <ProtectedRoute>
      <DashboardShell>
        <div className={styles.page}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Quản lý tải lên & Huấn luyện AI</h1>
              <p className={styles.description}>
                Cung cấp dữ liệu lâm sàng chất lượng cao để cải thiện độ chính xác của mô hình
                OsteoScan.
              </p>
            </div>

            <div className={styles.headerActions}>
              <button type="button" className={styles.ghostButton}>
                <span className="material-symbols-outlined">history</span>
                Lịch sử huấn luyện
              </button>
              <button type="button" className={styles.primaryButton} onClick={handleStartProcessing}>
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
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    cloud_upload
                  </span>
                </div>
                <h2 className={styles.uploadHeading}>
                  Kéo thả tệp tin vào đây hoặc{" "}
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
                              <div className={styles.progressTrack} style={{ marginTop: "6px" }}>
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

                          {/* <div className={styles.metadataGrid}>
                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-patient`}>ID bệnh nhân</label>
                              <input
                                id={`${item.id}-patient`}
                                type="text"
                                value={item.anonymousCode}
                                placeholder="P-98321"
                                onChange={(event) =>
                                  updateItem(item.id, "anonymousCode", event.target.value)
                                }
                              />
                            </div>

                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-region`}>Vùng quét</label>
                              <select
                                id={`${item.id}-region`}
                                value={item.bodyPart}
                                onChange={(event) =>
                                  updateItem(item.id, "bodyPart", event.target.value)
                                }
                              >
                                {scanZones.map((zone) => (
                                  <option key={zone.value} value={zone.value}>
                                    {zone.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-diagnosis`}>Nhãn chẩn đoán</label>
                              <select
                                id={`${item.id}-diagnosis`}
                                value={item.label}
                                onChange={(event) =>
                                  updateItem(item.id, "label", event.target.value)
                                }
                              >
                                {diagnosticLabels.map((label) => (
                                  <option key={label.value} value={label.value}>
                                    {label.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div> */}

                          <div className={styles.toggleRow}>
                            <button
                              type="button"
                              className={styles.toggleButton}
                              onClick={() => toggleExpand(item.id)}
                            >
                              <span className="material-symbols-outlined">
                                {expandedItems[item.id] ? "expand_less" : "expand_more"}
                              </span>
                              {expandedItems[item.id]
                                ? "Thu gọn thông số lâm sàng"
                                : "Cấu hình chi tiết dữ liệu lâm sàng (18 thông số)"}
                            </button>
                          </div>

                          {expandedItems[item.id] && (
                            <div className={styles.detailsPanel}>
                              {/* Patients Group */}
                              <fieldset className={styles.fieldGroup}>
                                <legend className={styles.groupLegend}>Patients</legend>
                                <div className={styles.fieldsGrid}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-anon-code`}>Mã ẩn danh (anonymous_code)</label>
                                    <input
                                      id={`${item.id}-anon-code`}
                                      type="text"
                                      value={item.anonymousCode}
                                      placeholder="Mã ẩn danh"
                                      onChange={(event) =>
                                        updateItem(item.id, "anonymousCode", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-age`}>Tuổi (age)</label>
                                    <input
                                      id={`${item.id}-age`}
                                      type="text"
                                      value={item.age}
                                      placeholder="VD: 55"
                                      onChange={(event) =>
                                        updateItem(item.id, "age", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-sex`}>Giới tính (sex)</label>
                                    <select
                                      id={`${item.id}-sex`}
                                      value={item.sex}
                                      onChange={(event) =>
                                        updateItem(item.id, "sex", event.target.value)
                                      }
                                    >
                                      <option value="M">M (Nam)</option>
                                      <option value="F">F (Nữ)</option>
                                      <option value="Other">Khác (Other)</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-height`}>Chiều cao (height_cm)</label>
                                    <input
                                      id={`${item.id}-height`}
                                      type="text"
                                      value={item.heightCm}
                                      placeholder="VD: 165.5"
                                      onChange={(event) =>
                                        updateItem(item.id, "heightCm", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-weight`}>Cân nặng (weight_kg)</label>
                                    <input
                                      id={`${item.id}-weight`}
                                      type="text"
                                      value={item.weightKg}
                                      placeholder="VD: 58.2"
                                      onChange={(event) =>
                                        updateItem(item.id, "weightKg", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-bmi`}>Chỉ số BMI (bmi)</label>
                                    <input
                                      id={`${item.id}-bmi`}
                                      type="text"
                                      value={item.bmi}
                                      placeholder="VD: 21.3"
                                      onChange={(event) =>
                                        updateItem(item.id, "bmi", event.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              </fieldset>

                              {/* XRay Images Group */}
                              <fieldset className={styles.fieldGroup}>
                                <legend className={styles.groupLegend}>Xray_images</legend>
                                <div className={styles.fieldsGrid}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-xray-date`}>Ngày chụp (xray_date)</label>
                                    <input
                                      id={`${item.id}-xray-date`}
                                      type="date"
                                      value={item.xrayDate}
                                      onChange={(event) =>
                                        updateItem(item.id, "xrayDate", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-view-type`}>Tư thế (view_type)</label>
                                    <select
                                      id={`${item.id}-view-type`}
                                      value={item.viewType}
                                      onChange={(event) =>
                                        updateItem(item.id, "viewType", event.target.value)
                                      }
                                    >
                                      <option value="AP">AP (Trước - Sau)</option>
                                      <option value="Lateral">Lateral (Nghiêng)</option>
                                      <option value="PA">PA (Sau - Trước)</option>
                                      <option value="Other">Tư thế khác</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-body-part`}>Vùng quét (body_part)</label>
                                    <select
                                      id={`${item.id}-body-part`}
                                      value={item.bodyPart}
                                      onChange={(event) =>
                                        updateItem(item.id, "bodyPart", event.target.value)
                                      }
                                    >
                                      {scanZones.map((zone) => (
                                        <option key={zone.value} value={zone.value}>
                                          {zone.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-vendor`}>Hãng máy (scanner_vendor)</label>
                                    <input
                                      id={`${item.id}-vendor`}
                                      type="text"
                                      value={item.scannerVendor}
                                      placeholder="VD: GE Healthcare"
                                      onChange={(event) =>
                                        updateItem(item.id, "scannerVendor", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-spacing`}>Khoảng cách pixel (pixel_spacing)</label>
                                    <input
                                      id={`${item.id}-spacing`}
                                      type="text"
                                      value={item.pixelSpacing}
                                      placeholder="VD: 0.142"
                                      onChange={(event) =>
                                        updateItem(item.id, "pixelSpacing", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-quality`}>Chất lượng (image_quality)</label>
                                    <select
                                      id={`${item.id}-quality`}
                                      value={item.imageQuality}
                                      onChange={(event) =>
                                        updateItem(item.id, "imageQuality", event.target.value)
                                      }
                                    >
                                      <option value="excellent">Excellent (Xuất sắc)</option>
                                      <option value="good">Good (Tốt)</option>
                                      <option value="acceptable">Acceptable (Chấp nhận được)</option>
                                      <option value="poor">Poor (Kém)</option>
                                    </select>
                                  </div>
                                </div>
                              </fieldset>

                              {/* Osteoporosis Labels Group */}
                              <fieldset className={styles.fieldGroup}>
                                <legend className={styles.groupLegend}>Osteoporosis_labels</legend>
                                <div className={styles.fieldsGrid}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-diagnosis-label`}>Phân loại nhãn (label)</label>
                                    <select
                                      id={`${item.id}-diagnosis-label`}
                                      value={item.label}
                                      onChange={(event) =>
                                        updateItem(item.id, "label", event.target.value)
                                      }
                                    >
                                      {diagnosticLabels.map((diag) => (
                                        <option key={diag.value} value={diag.value}>
                                          {diag.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-tscore`}>Chỉ số T-score (t_score)</label>
                                    <input
                                      id={`${item.id}-tscore`}
                                      type="text"
                                      value={item.tScore}
                                      placeholder="VD: -2.6"
                                      onChange={(event) =>
                                        updateItem(item.id, "tScore", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-bmd`}>Mật độ xương (bmd)</label>
                                    <input
                                      id={`${item.id}-bmd`}
                                      type="text"
                                      value={item.bmd}
                                      placeholder="VD: 0.785"
                                      onChange={(event) =>
                                        updateItem(item.id, "bmd", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-dxa-site`}>Vị trí DXA (dxa_site)</label>
                                    <select
                                      id={`${item.id}-dxa-site`}
                                      value={item.dxaSite}
                                      onChange={(event) =>
                                        updateItem(item.id, "dxaSite", event.target.value)
                                      }
                                    >
                                      <option value="lumbar_spine">Cột sống thắt lưng</option>
                                      <option value="femoral_neck">Cổ xương đùi</option>
                                      <option value="total_hip">Khớp háng toàn phần</option>
                                      <option value="forearm">Cẳng tay</option>
                                      <option value="other">Vị trí khác</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-dxa-date`}>Ngày đo DXA (dxa_date)</label>
                                    <input
                                      id={`${item.id}-dxa-date`}
                                      type="date"
                                      value={item.dxaDate}
                                      onChange={(event) =>
                                        updateItem(item.id, "dxaDate", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-source`}>Nguồn nhãn (label_source)</label>
                                    <select
                                      id={`${item.id}-source`}
                                      value={item.labelSource}
                                      onChange={(event) =>
                                        updateItem(item.id, "labelSource", event.target.value)
                                      }
                                    >
                                      <option value="DXA">DXA (Thiết bị DXA)</option>
                                      <option value="doctor">Doctor (Bác sĩ chẩn đoán)</option>
                                      <option value="rule_based">Rule-based (Thuật toán tự động)</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-split`}>Phân chia tập dữ liệu (dataset_split)</label>
                                    <select
                                      id={`${item.id}-split`}
                                      value={item.datasetSplit}
                                      onChange={(event) =>
                                        updateItem(item.id, "datasetSplit", event.target.value)
                                      }
                                    >
                                      <option value="train">Train (Huấn luyện)</option>
                                      <option value="validation">Validation (Kiểm định)</option>
                                      <option value="test">Test (Kiểm thử)</option>
                                    </select>
                                  </div>
                                </div>
                              </fieldset>
                            </div>
                          )}
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
                <h3 className={styles.sidebarTitle}>Tổng quan Dataset</h3>

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

                <button type="button" className={styles.trainButton} onClick={handleTrainNow}>
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

          {resultPopup && resultPopup.isOpen && (
            <div className={styles.popupOverlay}>
              <div
                className={`${styles.popupCard} ${
                  resultPopup.status === "success" ? styles.popupSuccess : styles.popupError
                }`}
              >
                <div className={styles.popupIcon}>
                  <span className="material-symbols-outlined">
                    {resultPopup.status === "success" ? "check_circle" : "error"}
                  </span>
                </div>
                <h3 className={styles.popupTitle}>
                  {resultPopup.status === "success" ? "Thành công" : "Thất bại"}
                </h3>
                <p className={styles.popupMessage}>{resultPopup.message}</p>
                <button
                  type="button"
                  className={styles.popupButton}
                  onClick={() => setResultPopup(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </DashboardShell>
    </ProtectedRoute>
  );
}

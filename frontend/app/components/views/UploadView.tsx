"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/context/AuthContext";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../upload/upload.module.css";
import { messages } from "@/app/messages";

type UploadStatus = "queued" | "uploading" | "success" | "error";
type ScanRegion = string;
type DiagnosisLabel = string;

const DEFAULT_SCAN_ZONES = [
  { name: messages.upload.defaultScanZones.lumbarSpine, value: "lumbar_spine" },
  { name: messages.upload.defaultScanZones.femoralNeck, value: "femoral_neck" },
  { name: messages.upload.defaultScanZones.other, value: "other" },
];

const DEFAULT_DIAGNOSTIC_LABELS = [
  { name: messages.upload.defaultDiagnosticLabels.normal, value: "normal" },
  { name: messages.upload.defaultDiagnosticLabels.osteopenia, value: "osteopenia" },
  { name: messages.upload.defaultDiagnosticLabels.osteoporosis, value: "osteoporosis" },
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
const acceptedTypes = ".dcm,.png,.jpg,.jpeg,image/*";

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
  const m = messages.upload;
  if (item.status === "success") {
    return m.status.success;
  }

  if (item.status === "error") {
    return item.errorMessage || m.status.errorDefault;
  }

  if (item.status === "uploading") {
    return m.status.uploading(item.progress);
  }

  return m.status.queued;
}

const uploadWithProgress = (
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    
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
        let errObj: any;
        try {
          errObj = JSON.parse(xhr.responseText);
        } catch (e) {
          errObj = { message: `Upload failed with status ${xhr.status}` };
        }
        errObj.status = xhr.status;
        reject(errObj);
      }
    };
    
    xhr.onerror = () => {
      reject(new Error("Network error"));
    };
    
    xhr.send(formData);
  });
};

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

export default function UploadPage() {
  const m = messages.upload;
  const { isAuthenticated } = useAuth();
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [csvData, setCsvData] = useState<Array<{
    patientId: string;
    heightMeter: string;
    weightKg: string;
    bmi: string;
    diagnosis: string;
    age: string;
    gender: string;
    tScore: string;
    datasetSplit: string;
  }> | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [augmentation, setAugmentation] = useState(false);
  const [crossValidation, setCrossValidation] = useState(true);
  const [selectedModel, setSelectedModel] = useState("EfficientNet-B3");

  const totalItems = items.length;
  const overallProgress = totalItems > 0
    ? Math.round(items.reduce((acc, item) => acc + (item.progress || 0), 0) / totalItems)
    : 0;
  const [resultPopup, setResultPopup] = useState<{
    isOpen: boolean;
    status: "success" | "error";
    message: string;
  } | null>(null);

  const [logs, setLogs] = useState(messages.upload.status.idleLogs);
  const [isTraining, setIsTraining] = useState(false);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const prevIsTrainingRef = useRef(false);

  // Training History States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(5);
  const [historySearchTrainer, setHistorySearchTrainer] = useState("");
  const [historySearchDate, setHistorySearchDate] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchHistory = async (page: number, trainer: string = "", date: string = "") => {
    if (!isAuthenticated) return;
    setIsHistoryLoading(true);
    try {
      const apiUrl = getApiUrl();
      let url = `${apiUrl}/v1/training/history?page=${page}&limit=${historyLimit}`;
      if (trainer.trim()) {
        url += `&search_trainer=${encodeURIComponent(trainer.trim())}`;
      }
      if (date.trim()) {
        url += `&search_date=${encodeURIComponent(date.trim())}`;
      }
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data = await response.json();
        setHistoryItems(data.data);
        setHistoryTotal(data.total);
        setHistoryPage(data.page);
      }
    } catch (error) {
      console.error("Error fetching training history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isHistoryOpen) {
      fetchHistory(1, historySearchTrainer, historySearchDate);
    }
  }, [isHistoryOpen]);

  useEffect(() => {
    if (isHistoryOpen) {
      const timer = setTimeout(() => {
        fetchHistory(1, historySearchTrainer, historySearchDate);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [historySearchTrainer, historySearchDate]);

  const fetchLogs = async () => {
    if (!isAuthenticated) return;
    try {
      const apiUrl = getApiUrl();
      const response = await fetchWithAuth(`${apiUrl}/v1/training/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setIsTraining(data.status === "running");
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLogs();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isTraining || !isAuthenticated) return;
    const interval = setInterval(fetchLogs, 1500);
    return () => clearInterval(interval);
  }, [isTraining, isAuthenticated]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (prevIsTrainingRef.current && !isTraining) {
      const logsLower = logs.toLowerCase();
      const isSuccess = logsLower.includes("completed successfully") || 
                        logsLower.includes("huấn luyện hoàn thành") || 
                        logsLower.includes("success") || 
                        logsLower.includes("completed");
      const isZeroRecords = logsLower.includes("zero records available") || 
                            logsLower.includes("no records");
      const isCriticalError = logsLower.includes("critical error") || 
                              logsLower.includes("failed") || 
                              logsLower.includes("error");

      if (isSuccess) {
        setResultPopup({
          isOpen: true,
          status: "success",
          message: "Quá trình huấn luyện mô hình đã hoàn thành thành công!",
        });
      } else if (isZeroRecords) {
        setResultPopup({
          isOpen: true,
          status: "error",
          message: "Không có dữ liệu mới để huấn luyện mô hình.",
        });
      } else if (isCriticalError) {
        setResultPopup({
          isOpen: true,
          status: "error",
          message: "Quá trình huấn luyện mô hình đã thất bại. Vui lòng kiểm tra nhật ký lỗi!",
        });
      } else {
        setResultPopup({
          isOpen: true,
          status: "success",
          message: "Quá trình huấn luyện mô hình đã hoàn thành.",
        });
      }
    }
    prevIsTrainingRef.current = isTraining;
  }, [isTraining, logs]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchOptions = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetchWithAuth(`${apiUrl}/v1/upload/options`);
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
  }, [isAuthenticated]);

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

        const newItem = { ...item, [key]: value };

        // Automatically calculate BMI if height or weight changes
        if (key === "heightCm" || key === "weightKg") {
          const height = parseFloat(newItem.heightCm);
          const weight = parseFloat(newItem.weightKg);

          if (!isNaN(height) && height > 0 && !isNaN(weight) && weight > 0) {
            // BMI = weight / (height / 100)^2
            const calculatedBmi = (weight / Math.pow(height / 100, 2)).toFixed(1);
            newItem.bmi = calculatedBmi;
          } else {
            newItem.bmi = "";
          }
        }

        return newItem;
      })
    );
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text: string) => {
    const cleanText = text.replace(/^\uFEFF/, "");
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    
    const cleanToken = (t: string) => {
      return (t || "").replace(/^["\s\uFEFF]+|["\s\uFEFF]+$/g, '').trim();
    };

    const findIndex = (names: string[]) => {
      return headers.findIndex(h => {
        const cleanH = cleanToken(h).toLowerCase().replace(/\s+/g, ' ');
        return names.some(name => cleanH === name.trim().toLowerCase().replace(/\s+/g, ' '));
      });
    };

    const idxPatientId = findIndex(["patient id", "patientid", "id"]);
    const idxHeight = findIndex(["height (meter)", "height(meter)", "height  (meter)", "height meter", "height"]);
    const idxWeight = findIndex(["weight (kg)", "weight(kg)", "weight (kg) ", "weight kg", "weight"]);
    const idxBmi = findIndex(["bmi", "bmi:"]);
    const idxDiagnosis = findIndex(["diagnosis", "diagnostic", "nhãn chẩn đoán", "nhan chan doan"]);
    const idxAge = findIndex(["age", "tuổi", "tuoi"]);
    const idxGender = findIndex(["gender", "sex", "giới tính", "gioi tinh"]);
    const idxTscore = findIndex(["t-score", "tscore", "t score", "t_score", "t score value", "t-score value"]);
    const idxDatasetSplit = findIndex(["dataset split", "dataset_split", "dataset-split", "split", "tập dữ liệu", "tap du lieu"]);

    if (idxPatientId === -1) {
      alert("Không tìm thấy cột 'Patient Id' trong file CSV.");
      return [];
    }

    const parsedRows: Array<{
      patientId: string;
      heightMeter: string;
      weightKg: string;
      bmi: string;
      diagnosis: string;
      age: string;
      gender: string;
      tScore: string;
      datasetSplit: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      if (cols.length <= idxPatientId) continue;

      parsedRows.push({
        patientId: cleanToken(cols[idxPatientId]),
        heightMeter: idxHeight !== -1 ? cleanToken(cols[idxHeight]) : "",
        weightKg: idxWeight !== -1 ? cleanToken(cols[idxWeight]) : "",
        bmi: idxBmi !== -1 ? cleanToken(cols[idxBmi]) : "",
        diagnosis: idxDiagnosis !== -1 ? cleanToken(cols[idxDiagnosis]) : "",
        age: idxAge !== -1 ? cleanToken(cols[idxAge]) : "",
        gender: idxGender !== -1 ? cleanToken(cols[idxGender]) : "",
        tScore: idxTscore !== -1 ? cleanToken(cols[idxTscore]) : "",
        datasetSplit: idxDatasetSplit !== -1 ? cleanToken(cols[idxDatasetSplit]) : "",
      });
    }

    return parsedRows;
  };

  const handleOpenCsvPicker = () => {
    csvInputRef.current?.click();
  };

  const handleCsvChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setCsvData(parsed);
      } else {
        setCsvData(null);
        setCsvFileName("");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleAutoFill = () => {
    if (!csvData || csvData.length === 0) return;

    const mapDiagnosis = (val: string): string => {
      const v = (val || "").trim().toLowerCase();
      if (v.includes("normal") || v.includes("bình thường") || v.includes("binh thuong")) return "normal";
      if (v.includes("osteopenia") || v.includes("thiếu xương") || v.includes("thieu xuong")) return "osteopenia";
      if (v.includes("osteoporosis") || v.includes("loãng xương") || v.includes("loang xuong") || v.includes("lở xương") || v.includes("lo xuong")) return "osteoporosis";
      return "normal";
    };

    const mapSex = (val: string): string => {
      const v = (val || "").trim().toLowerCase();
      if (v.startsWith("m") || v === "nam") return "M";
      if (v.startsWith("f") || v.startsWith("n") || v === "nữ" || v === "nu") return "F";
      return "Other";
    };

    const mapDatasetSplit = (val: string): "train" | "validation" | "test" => {
      const v = (val || "").trim().toLowerCase();
      if (v.includes("validation") || v === "val" || v === "valid") return "validation";
      if (v.includes("test")) return "test";
      return "train";
    };

    setItems((current) =>
      current.map((item) => {
        const prefix = item.file.name.split(/[._-]/)[0] || "";
        const row = csvData.find(r => r.patientId.trim().toLowerCase() === prefix.trim().toLowerCase());

        if (row) {
          const heightMeter = parseFloat(row.heightMeter);
          const weightKg = parseFloat(row.weightKg);
          let heightCmStr = "";
          let weightKgStr = "";
          let bmiStr = "";

          if (!isNaN(heightMeter) && heightMeter > 0) {
            heightCmStr = (heightMeter * 100).toFixed(1);
          }
          if (!isNaN(weightKg) && weightKg > 0) {
            weightKgStr = weightKg.toString();
          }

          if (heightMeter > 0 && weightKg > 0) {
            bmiStr = (weightKg / Math.pow(heightMeter, 2)).toFixed(1);
          } else if (row.bmi) {
            const parsedBmi = parseFloat(row.bmi);
            if (!isNaN(parsedBmi) && parsedBmi > 0) {
              bmiStr = parsedBmi.toFixed(1);
            }
          }

          return {
            ...item,
            heightCm: heightCmStr,
            weightKg: weightKgStr,
            bmi: bmiStr,
            label: mapDiagnosis(row.diagnosis),
            age: row.age,
            sex: mapSex(row.gender),
            tScore: row.tScore || "",
            datasetSplit: row.datasetSplit ? mapDatasetSplit(row.datasetSplit) : "train"
          };
        } else {
          return {
            ...item,
            heightCm: "",
            weightKg: "",
            bmi: "",
            label: "normal",
            age: "",
            sex: "M",
            tScore: "",
            datasetSplit: "train"
          };
        }
      })
    );

    setResultPopup({
      isOpen: true,
      status: "success",
      message: "Tự động điền dữ liệu lâm sàng từ file CSV thành công!",
    });
  };

  const handleStartProcessing = async () => {
    const queuedItems = items.filter((item) => item.status === "queued" || item.status === "error");
    if (queuedItems.length === 0) {
      setResultPopup({
        isOpen: true,
        status: "error",
        message: m.messages.noNewData,
      });
      return;
    }

    setIsProcessing(true);
    let hasError = false;
    const apiUrl = getApiUrl();
    const concurrency = 4;
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIdx = nextIndex++;
        if (currentIdx >= queuedItems.length) {
          break;
        }

        const item = queuedItems[currentIdx];

        if (item.file.size > MAX_FILE_SIZE) {
          updateItem(item.id, "status", "error");
          updateItem(item.id, "errorMessage", m.messages.fileTooLarge);
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

          let uploadErr: any = null;
          try {
            await uploadWithProgress(`${apiUrl}/v1/upload`, formData, (progress) => {
              updateItem(item.id, "progress", progress);
            });
          } catch (err: any) {
            if (err.status === 401) {
              const refreshed = await tryRefreshSession();
              if (refreshed) {
                try {
                  await uploadWithProgress(`${apiUrl}/v1/upload`, formData, (progress) => {
                    updateItem(item.id, "progress", progress);
                  });
                } catch (retryErr: any) {
                  uploadErr = retryErr;
                }
              } else {
                uploadErr = err;
              }
            } else {
              uploadErr = err;
            }
          }

          if (uploadErr) {
            throw uploadErr;
          }

          updateItem(item.id, "status", "success");
          updateItem(item.id, "progress", 100);
        } catch (error: any) {
          console.error("Upload error for item", item.id, error);
          updateItem(item.id, "status", "error");
          updateItem(item.id, "errorMessage", error.detail || error.message || m.messages.uploadFailed);
          updateItem(item.id, "progress", 0);
          hasError = true;
        }
      }
    };

    try {
      const workers = Array.from(
        { length: Math.min(concurrency, queuedItems.length) },
        worker
      );
      await Promise.all(workers);

      if (hasError) {
        setResultPopup({
          isOpen: true,
          status: "error",
          message: m.messages.uploadFailed,
        });
      } else {
        setResultPopup({
          isOpen: true,
          status: "success",
          message: m.messages.uploadSuccess,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrainNow = async () => {
    if (!isAuthenticated) {
      setResultPopup({
        isOpen: true,
        status: "error",
        message: m.messages.loginRequired,
      });
      return;
    }

    try {
      const apiUrl = getApiUrl();
      const response = await fetchWithAuth(`${apiUrl}/v1/training/train?use_augmentation=${augmentation}`, {
        method: "POST",
      });

      if (!response.ok) {
        let errMsg = m.messages.connectFailed;
        try {
          const errData = await response.json();
          errMsg = errData.detail || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const resData = await response.json();
      setResultPopup({
        isOpen: true,
        status: "success",
        message: resData.message || m.messages.trainSuccess,
      });
      console.log("Training started:", resData);
      setIsTraining(true);
    } catch (error: any) {
      console.error("Error starting training:", error);
      setResultPopup({
        isOpen: true,
        status: "error",
        message: error.message || m.messages.connectFailed,
      });
    }
  };

  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const readyCount = items.filter((item) => item.status === "success").length;
  const unlabeledCount = items.filter((item) => !item.anonymousCode.trim()).length;
  const readiness = items.length === 0 ? 0 : Math.round((readyCount / items.length) * 100);

  return (
    <div className={styles.page}>
          <header className={styles.header}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>{m.view.title}</h1>
              <p className={styles.description}>
                {m.view.description}
              </p>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => setIsHistoryOpen(true)}
                disabled={isProcessing}
                style={isProcessing ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
              >
                <span className="material-symbols-outlined">history</span>
                {m.view.btnHistory}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleStartProcessing}
                disabled={isProcessing || isTraining}
                style={(isProcessing || isTraining) ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
              >
                <span className="material-symbols-outlined">model_training</span>
                {m.view.btnStart}
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
                style={isProcessing ? { opacity: 0.6, cursor: "not-allowed", pointerEvents: "none" } : undefined}
              >
                <div className={styles.uploadIcon}>
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    cloud_upload
                  </span>
                </div>
                <h2 className={styles.uploadHeading}>
                  {m.view.dragPrompt}{" "}
                  <button type="button" onClick={handleOpenPicker}>
                    {m.view.btnBrowse}
                  </button>
                </h2>
                <p className={styles.uploadCaption}>
                  {m.view.uploadCaption}
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
                  <h3 className={styles.queueTitle}>{m.view.queueTitle(items.length)}</h3>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      onChange={handleCsvChange}
                    />
                    <button
                      type="button"
                      className={styles.csvButton}
                      onClick={handleOpenCsvPicker}
                      disabled={isProcessing}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle", marginRight: "4px" }}>
                        upload_file
                      </span>
                      {csvFileName ? `CSV: ${csvFileName}` : "Tải lên file CSV"}
                    </button>
                    <button
                      type="button"
                      className={styles.autofillButton}
                      onClick={handleAutoFill}
                      disabled={isProcessing || !csvData || items.length === 0}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle", marginRight: "4px" }}>
                        bolt
                      </span>
                      Tự động điền (AutoFill)
                    </button>
                    <button
                      type="button"
                      className={styles.clearButton}
                      onClick={handleClearAll}
                      disabled={isProcessing}
                      style={isProcessing ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    >
                      {m.view.btnClearAll}
                    </button>
                  </div>
                </div>

                {isProcessing && (
                  <div style={{ padding: "12px 14px 4px", borderBottom: "1px solid #d8e1f1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#103f9c" }}>
                        {m.status.processingOverall(overallProgress)}
                      </span>
                    </div>
                    <div className={styles.progressTrack} style={{ height: "8px" }}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${overallProgress}%`, transition: "width 0.3s ease" }}
                      />
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className={styles.queueEmpty}>
                    {m.view.queueEmpty}
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
                              disabled={isProcessing}
                              style={isProcessing ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                            >
                              <span className="material-symbols-outlined">
                                {item.status === "uploading" ? "close" : "delete"}
                              </span>
                            </button>
                          </div>

                          {/* <div className={styles.metadataGrid}>
                            <div className={styles.field}>
                              <label htmlFor={`${item.id}-patient`}>{m.view.labelPatientId}</label>
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
                              <label htmlFor={`${item.id}-region`}>{m.view.labelScanZone}</label>
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
                              <label htmlFor={`${item.id}-diagnosis`}>{m.view.labelDiagnosis}</label>
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
                                ? m.view.btnCollapseClinical
                                : m.view.btnExpandClinical}
                            </button>
                          </div>

                          {expandedItems[item.id] && (
                            <div className={styles.detailsPanel}>
                              {/* Patients Group */}
                              <fieldset className={styles.fieldGroup}>
                                <legend className={styles.groupLegend}>Patients</legend>
                                <div className={styles.fieldsGrid}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-anon-code`}>{m.view.labelAnonCode}</label>
                                    <input
                                      id={`${item.id}-anon-code`}
                                      type="text"
                                      value={item.anonymousCode}
                                      placeholder={m.view.placeholderAnonCode}
                                      onChange={(event) =>
                                        updateItem(item.id, "anonymousCode", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-age`}>{m.view.labelAge}</label>
                                    <input
                                      id={`${item.id}-age`}
                                      type="text"
                                      value={item.age}
                                      placeholder={m.view.placeholderAge}
                                      onChange={(event) =>
                                        updateItem(item.id, "age", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-sex`}>{m.view.labelSex}</label>
                                    <select
                                      id={`${item.id}-sex`}
                                      value={item.sex}
                                      onChange={(event) =>
                                        updateItem(item.id, "sex", event.target.value)
                                      }
                                    >
                                      <option value="M">{m.view.sexMale}</option>
                                      <option value="F">{m.view.sexFemale}</option>
                                      <option value="Other">{m.view.sexOther}</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                     <label htmlFor={`${item.id}-height`}>{m.view.labelHeight}</label>
                                     <input
                                       id={`${item.id}-height`}
                                       type="text"
                                       value={item.heightCm}
                                       placeholder={m.view.placeholderHeight}
                                       onChange={(event) =>
                                         updateItem(item.id, "heightCm", event.target.value)
                                       }
                                     />
                                   </div>
                                   <div className={styles.field}>
                                     <label htmlFor={`${item.id}-weight`}>{m.view.labelWeight}</label>
                                     <input
                                       id={`${item.id}-weight`}
                                       type="text"
                                       value={item.weightKg}
                                       placeholder={m.view.placeholderWeight}
                                       onChange={(event) =>
                                         updateItem(item.id, "weightKg", event.target.value)
                                       }
                                     />
                                   </div>
                                   <div className={styles.field}>
                                     <label htmlFor={`${item.id}-bmi`}>{m.view.labelBmi}</label>
                                     <input
                                       id={`${item.id}-bmi`}
                                       type="text"
                                       value={item.bmi}
                                       placeholder={m.view.placeholderBmi}
                                       disabled
                                     />
                                   </div>
                                </div>
                              </fieldset>

                              {/* XRay Images Group */}
                              {/* <fieldset className={styles.fieldGroup}>
                                <legend className={styles.groupLegend}>Xray_images</legend>
                                <div className={styles.fieldsGrid}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-xray-date`}>{m.view.labelXrayDate}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <input
                                      id={`${item.id}-xray-date`}
                                      type="date"
                                      value={item.xrayDate}
                                      onChange={(event) =>
                                        updateItem(item.id, "xrayDate", event.target.value)
                                      }
                                      disabled
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-view-type`}>{m.view.labelViewType}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <select
                                      id={`${item.id}-view-type`}
                                      value={item.viewType}
                                      onChange={(event) =>
                                        updateItem(item.id, "viewType", event.target.value)
                                      }
                                      disabled
                                    >
                                      <option value="AP">{m.view.viewTypeAP}</option>
                                      <option value="Lateral">{m.view.viewTypeLateral}</option>
                                      <option value="PA">{m.view.viewTypePA}</option>
                                      <option value="Other">{m.view.viewTypeOther}</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-body-part`}>{m.view.labelScanZone} (body_part) <span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <select
                                      id={`${item.id}-body-part`}
                                      value={item.bodyPart}
                                      onChange={(event) =>
                                        updateItem(item.id, "bodyPart", event.target.value)
                                      }
                                      disabled
                                    >
                                      {scanZones.map((zone) => (
                                        <option key={zone.value} value={zone.value}>
                                          {zone.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-vendor`}>{m.view.labelScannerVendor}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <input
                                      id={`${item.id}-vendor`}
                                      type="text"
                                      value={item.scannerVendor}
                                      placeholder={m.view.placeholderScannerVendor}
                                      onChange={(event) =>
                                        updateItem(item.id, "scannerVendor", event.target.value)
                                      }
                                      disabled
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-spacing`}>{m.view.labelPixelSpacing}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <input
                                      id={`${item.id}-spacing`}
                                      type="text"
                                      value={item.pixelSpacing}
                                      placeholder={m.view.placeholderPixelSpacing}
                                      onChange={(event) =>
                                        updateItem(item.id, "pixelSpacing", event.target.value)
                                      }
                                      disabled
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-quality`}>{m.view.labelImageQuality}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <select
                                      id={`${item.id}-quality`}
                                      value={item.imageQuality}
                                      onChange={(event) =>
                                        updateItem(item.id, "imageQuality", event.target.value)
                                      }
                                      disabled
                                    >
                                      <option value="excellent">{m.view.qualityExcellent}</option>
                                      <option value="good">{m.view.qualityGood}</option>
                                      <option value="acceptable">{m.view.qualityAcceptable}</option>
                                      <option value="poor">{m.view.qualityPoor}</option>
                                    </select>
                                  </div>
                                </div>
                              </fieldset> */}

                              {/* Osteoporosis Labels Group */}
                              <fieldset className={styles.fieldGroup}>
                                <legend className={styles.groupLegend}>Osteoporosis_labels</legend>
                                <div className={styles.fieldsGrid}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-diagnosis-label`}>{m.view.labelDiagnosis} (label)</label>
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
                                    <label htmlFor={`${item.id}-tscore`}>{m.view.labelTScore}</label>
                                    <input
                                      id={`${item.id}-tscore`}
                                      type="text"
                                      value={item.tScore}
                                      placeholder={m.view.placeholderTScore}
                                      onChange={(event) =>
                                        updateItem(item.id, "tScore", event.target.value)
                                      }
                                    />
                                  </div>
                                  {/* <div className={styles.field}>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-bmd`}>{m.view.labelBmd}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <input
                                      id={`${item.id}-bmd`}
                                      type="text"
                                      value={item.bmd}
                                      placeholder={m.view.placeholderBmd}
                                      onChange={(event) =>
                                        updateItem(item.id, "bmd", event.target.value)
                                      }
                                      disabled
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-dxa-site`}>{m.view.labelDxaSite}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <select
                                      id={`${item.id}-dxa-site`}
                                      value={item.dxaSite}
                                      onChange={(event) =>
                                        updateItem(item.id, "dxaSite", event.target.value)
                                      }
                                      disabled
                                    >
                                      <option value="lumbar_spine">{m.view.dxaSiteLumbar}</option>
                                      <option value="femoral_neck">{m.view.dxaSiteNeck}</option>
                                      <option value="total_hip">{m.view.dxaSiteHip}</option>
                                      <option value="forearm">{m.view.dxaSiteForearm}</option>
                                      <option value="other">{m.view.dxaSiteOther}</option>
                                    </select>
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-dxa-date`}>{m.view.labelDxaDate}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <input
                                      id={`${item.id}-dxa-date`}
                                      type="date"
                                      value={item.dxaDate}
                                      onChange={(event) =>
                                        updateItem(item.id, "dxaDate", event.target.value)
                                      }
                                      disabled
                                    />
                                  </div>
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-source`}>{m.view.labelLabelSource}<span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>{m.view.labelXrayDateNote}</span></label>
                                    <select
                                      id={`${item.id}-source`}
                                      value={item.labelSource}
                                      onChange={(event) =>
                                        updateItem(item.id, "labelSource", event.target.value)
                                      }
                                      disabled
                                    >
                                      <option value="DXA">{m.view.sourceDxa}</option>
                                      <option value="doctor">{m.view.sourceDoctor}</option>
                                      <option value="rule_based">{m.view.sourceRuleBased}</option>
                                    </select>
                                  </div> */}
                                  <div className={styles.field}>
                                    <label htmlFor={`${item.id}-split`}>{m.view.labelSplit}</label>
                                    <select
                                      id={`${item.id}-split`}
                                      value={item.datasetSplit}
                                      onChange={(event) =>
                                        updateItem(item.id, "datasetSplit", event.target.value)
                                      }
                                    >
                                      <option value="train">{m.view.splitTrain}</option>
                                      <option value="validation">{m.view.splitVal}</option>
                                      <option value="test">{m.view.splitTest}</option>
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
                  {m.view.btnHistoryAdd}
                </button>
              </section>
            </div>

            <aside className={styles.sidebarColumn}>
              <section className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>{m.view.sidebarTitle}</h3>

                <div className={styles.overviewList}>
                  <div className={styles.overviewRow}>
                    <span>{m.view.totalFiles}</span>
                    <span className={styles.overviewValue}>{items.length}</span>
                  </div>
                  <div className={styles.overviewRow}>
                    <span>{m.view.labeledFiles}</span>
                    <span className={styles.overviewValue}>
                      {items.length - unlabeledCount} / {items.length}
                    </span>
                  </div>
                  <div className={styles.overviewRow}>
                    <span>{m.view.unlabeledFiles}</span>
                    <span className={styles.overviewValue}>{unlabeledCount}</span>
                  </div>
                  <div className={styles.overviewRow}>
                    <span>{m.view.totalSize}</span>
                    <span className={styles.overviewValue}>{formatFileSize(totalSize)}</span>
                  </div>
                </div>

                <div className={styles.progressHeader}>
                  <span>{m.view.readinessTitle}</span>
                  <span>{readiness}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${readiness}%` }} />
                </div>
                <p className={styles.progressHint}>
                  {m.view.readinessHint}
                </p>

                <button type="button" className={styles.trainButton} onClick={handleTrainNow}>
                  <span className="material-symbols-outlined" style={{ verticalAlign: "middle" }}>
                    play_circle
                  </span>{" "}
                  {m.view.btnTrainNow}
                </button>
                <p className={styles.eta}>
                  {m.view.etaText}<strong>{m.view.etaTime}</strong>
                </p>
              </section>

              <section className={styles.logCard}>
                <div className={styles.logHeader}>
                  <h3 className={styles.logTitle}>{m.view.terminalTitle}</h3>
                  <div className={styles.logStatus}>
                    <span className={`${styles.statusDot} ${isTraining ? styles.statusDotActive : ""}`} />
                    <span>{isTraining ? m.status.running : m.status.idle}</span>
                  </div>
                </div>
                <div ref={terminalRef} className={styles.logTerminal}>
                  {logs}
                </div>
              </section>

              {/* <section className={styles.configCard}>
                <p className={styles.configLabel}>Model configuration</p>

                <div className={styles.configField}>
                  <label htmlFor="model-select">Base model <span style={{fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal"}}>(Fixed)</span></label>
                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    disabled
                  >
                    <option value="EfficientNet-B3">EfficientNet-B3 (Osteoporosis classification)</option>
                  </select>
                </div>

                <label className={styles.checkRow} style={{ opacity: 0.6, cursor: "not-allowed" }}>
                  <input
                    type="checkbox"
                    checked={augmentation}
                    onChange={(event) => setAugmentation(event.target.checked)}
                    disabled
                  />
                  <span>Use Data Augmentation <span style={{fontSize: "0.7rem", color: "#94a3b8"}}>(Fixed - Not used)</span></span>
                </label>

                <label className={styles.checkRow} style={{ opacity: 0.6, cursor: "not-allowed" }}>
                  <input
                    type="checkbox"
                    checked={crossValidation}
                    onChange={(event) => setCrossValidation(event.target.checked)}
                    disabled
                  />
                  <span>Automated Cross-validation <span style={{fontSize: "0.7rem", color: "#94a3b8"}}>(Fixed - Enabled)</span></span>
                </label>
              </section> */}
            </aside>
          </div>

          {showToast ? (
            <div className={styles.toast}>
              <span className="material-symbols-outlined" style={{ color: "#61d895" }}>
                check_circle
              </span>
              <span>{m.view.toastSuccess}</span>
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
                  {resultPopup.status === "success" ? m.view.popupSuccessTitle : m.view.popupErrorTitle}
                </h3>
                <p className={styles.popupMessage}>{resultPopup.message}</p>
                <button
                  type="button"
                  className={styles.popupButton}
                  onClick={() => setResultPopup(null)}
                >
                  {m.view.popupBtnClose}
                </button>
              </div>
            </div>
          )}

          {isHistoryOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalContainer}>
                <header className={styles.modalHeader}>
                  <h3 className={styles.modalTitle}>{m.view.historyTitle}</h3>
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setIsHistoryOpen(false)}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </header>

                <div className={styles.modalBody}>
                  <div className={styles.searchBar}>
                    <div className={styles.searchInputWrapper}>
                      <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
                      <input
                        type="text"
                        className={styles.searchInput}
                        placeholder={m.view.placeholderSearchTrainer}
                        value={historySearchTrainer}
                        onChange={(e) => setHistorySearchTrainer(e.target.value)}
                      />
                    </div>
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={historySearchDate}
                      onChange={(e) => setHistorySearchDate(e.target.value)}
                    />
                    {(historySearchTrainer || historySearchDate) && (
                      <button
                        type="button"
                        className={styles.pageButton}
                        onClick={() => {
                          setHistorySearchTrainer("");
                          setHistorySearchDate("");
                        }}
                      >
                        {m.view.btnHistoryClearFilters}
                      </button>
                    )}
                  </div>

                  {isHistoryLoading ? (
                    <div className={styles.emptyState}>{m.view.historyLoading}</div>
                  ) : historyItems.length === 0 ? (
                    <div className={styles.emptyState}>{m.view.historyEmpty}</div>
                  ) : (
                    <>
                      <div className={styles.historyTableWrapper}>
                        <table className={styles.historyTable}>
                          <thead>
                            <tr>
                              <th>{m.view.thCreatedDate}</th>
                              <th>{m.view.thTrainer}</th>
                              <th>{m.view.thClinicalInfo}</th>
                              <th>{m.view.thResult}</th>
                              <th>{m.view.thMetrics}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyItems.map((item) => (
                              <tr key={item.id}>
                                <td>{item.created_at ? new Date(item.created_at).toLocaleString("vi-VN") : "N/A"}</td>
                                <td>{item.trainer_name}</td>
                                <td className={styles.clinicalInfoCell} title={item.clinical_info}>
                                  {item.clinical_info}
                                </td>
                                <td>
                                  <span
                                    className={`${styles.statusBadge} ${
                                      item.status === "success"
                                        ? styles.success
                                        : item.status === "failed"
                                        ? styles.failed
                                        : styles.running
                                    }`}
                                  >
                                    {item.status === "success"
                                      ? m.view.historyStatusSuccess
                                      : item.status === "failed"
                                      ? m.view.historyStatusFailed
                                      : m.view.historyStatusRunning}
                                  </span>
                                </td>
                                <td>
                                  {item.status === "success" ? (
                                    <span>
                                      {m.view.historyMetricLabel(item.accuracy !== null ? `${(item.accuracy * 100).toFixed(1)}%` : "N/A", item.loss !== null ? item.loss.toFixed(4) : "N/A")}
                                    </span>
                                  ) : item.status === "failed" ? (
                                    <span className={styles.errorText} title={item.error_message}>
                                      {m.view.historyErrorLabel(item.error_message)}
                                    </span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.pagination}>
                        <span>
                          {m.view.paginationLabel(
                            Math.min((historyPage - 1) * historyLimit + 1, historyTotal),
                            Math.min(historyPage * historyLimit, historyTotal),
                            historyTotal
                          )}
                        </span>
                        <div className={styles.paginationButtons}>
                          <button
                            type="button"
                            className={styles.pageButton}
                            disabled={historyPage === 1}
                            onClick={() => fetchHistory(historyPage - 1, historySearchTrainer, historySearchDate)}
                          >
                            {m.view.btnPrev}
                          </button>
                          <button
                            type="button"
                            className={styles.pageButton}
                            disabled={historyPage * historyLimit >= historyTotal}
                            onClick={() => fetchHistory(historyPage + 1, historySearchTrainer, historySearchDate)}
                          >
                            {m.view.btnNext}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
    </div>
  );
}

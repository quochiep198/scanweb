"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { useAuth } from "@/app/context/AuthContext";
import { DashboardShell } from "@/components/layouts/DashboardShell";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [stats, setStats] = useState({
    uploadTodayCount: 0,
    trainedTodayCount: 0,
  });

  useEffect(() => {
    if (!accessToken) return;

    const fetchStats = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const response = await fetch(`${API_URL}/v1/dashboard/stats`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            uploadTodayCount: data.upload_today_count,
            trainedTodayCount: data.trained_today_count,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, [accessToken]);

  const cards = [
    {
      icon: "dataset",
      title: "Mẫu upload hôm nay",
      value: `${stats.uploadTodayCount}`,
      detail: "Số lượng ảnh X-ray đã được upload lên hệ thống trong ngày hôm nay.",
    },
    {
      icon: "monitoring",
      title: "Mẫu đã training hôm nay",
      value: `${stats.trainedTodayCount}`,
      detail: "Số lượng mẫu đã hoàn thành huấn luyện cho AI trong ngày hôm nay.",
    }
  ];

  return (
    <ProtectedRoute>
      <DashboardShell>
        <section className={styles.page}>
          <div className={styles.statsGrid}>
            {cards.map((card) => (
              <article key={card.title} className={styles.statCard}>
                <div className={styles.statIcon}>
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <p className={styles.statLabel}>{card.title}</p>
                <p className={styles.statValue}>{card.value}</p>
                <p className={styles.statDetail}>{card.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </DashboardShell>
    </ProtectedRoute>
  );
}

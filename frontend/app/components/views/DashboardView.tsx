"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../dashboard/dashboard.module.css";

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    uploadTodayCount: 0,
    trainedTodayCount: 0,
    uploadCount: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStats = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/v1/dashboard/stats`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            uploadTodayCount: data.upload_today_count,
            trainedTodayCount: data.trained_today_count,
            uploadCount: data.upload_count,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    };

    fetchStats();
  }, [isAuthenticated]);

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
    },
    {
      icon: "dataset",
      title: "Mẫu đã upload",
      value: `${stats.uploadCount}`,
      detail: "Tổng số lượng mẫu đã được upload lên hệ thống.",
    }
  ];

  return (
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
  );
}

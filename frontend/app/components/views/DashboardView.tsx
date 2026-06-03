"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { getApiUrl } from "@/app/lib/api";
import styles from "../../dashboard/dashboard.module.css";
import { messages } from "@/app/messages";

export default function DashboardPage() {
  const m = messages.dashboard;
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
      title: m.uploadTodayTitle,
      value: `${stats.uploadTodayCount}`,
      detail: m.uploadTodayDesc,
    },
    {
      icon: "monitoring",
      title: m.trainedTodayTitle,
      value: `${stats.trainedTodayCount}`,
      detail: m.trainedTodayDesc,
    },
    {
      icon: "dataset",
      title: m.totalUploadTitle,
      value: `${stats.uploadCount}`,
      detail: m.totalUploadDesc,
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

"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/app/context/AuthContext";
import styles from "@/components/layouts/dashboard-shell.module.css";

import { messages } from "@/app/messages";

type NavItem = {
  view: string;
  label: string;
  icon: string;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { view: "dashboard", label: messages.dashboardShell.navDashboard, icon: "dashboard" },
  { view: "upload", label: messages.dashboardShell.navUpload, icon: "upload_file" },
  { view: "measurement", label: messages.dashboardShell.navMeasurement, icon: "straighten" },
];

const footerItems: NavItem[] = [];

function getInitials(name?: string) {
  if (!name) {
    return "OA";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type DashboardShellProps = {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
};

export function DashboardShell({ children, currentView, onViewChange }: DashboardShellProps) {
  const { logout, user } = useAuth();

  return (
    <div className={`${styles.shell} dashboard-shell-root`}>
      <header className={styles.topbar}>
        <div className={styles.brand}>OsteoScan AI</div>

        <label className={styles.search} aria-label="Tim kiem">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Tim kiem du lieu..." />
        </label>

        <div className={styles.topbarActions}>
          <button type="button" className={styles.iconButton} aria-label="Thong bao">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Tro giup">
            <span className="material-symbols-outlined">help</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Cai dat">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className={styles.avatar} aria-hidden="true">
            {getInitials(user?.name)}
          </div>
        </div>
      </header>

      <div className={styles.frame}>
        <aside className={styles.sidebar}>
          <div className={styles.clinicCard}>
            <div className={styles.clinicIcon}>
              <span className="material-symbols-outlined">health_and_safety</span>
            </div>
            <div>
              <h2 className={styles.clinicTitle}>{messages.dashboardShell.clinicTitleDefault}</h2>
              <p className={styles.clinicSubtitle}>{messages.dashboardShell.clinicSubtitleDefault}</p>
            </div>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              const className = isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink;

              if (item.disabled) {
                return (
                  <span key={item.view} className={className} aria-disabled="true">
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                );
              }

              return (
                <button
                  type="button"
                  key={item.view}
                  onClick={() => onViewChange(item.view)}
                  className={className}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.sidebarFooter}>
            {footerItems.map((item) => (
              <button type="button" key={item.label} onClick={() => onViewChange(item.view)} className={styles.navLink}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <button type="button" className={styles.navLink} onClick={logout}>
              <span className="material-symbols-outlined">logout</span>
              <span>{messages.dashboardShell.logout}</span>
            </button>
          </div>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

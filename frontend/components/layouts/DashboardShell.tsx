"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/app/context/AuthContext";
import styles from "@/components/layouts/dashboard-shell.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Quản lý chung", icon: "dashboard" },
  // { href: "/patients", label: "Hồ sơ bệnh nhân", icon: "person", disabled: true },
  { href: "/upload", label: "Tải lên & Huấn luyện", icon: "upload_file" },
  { href: "/measurement", label: "Đo lường", icon: "straighten" },
  // { href: "/reports", label: "Báo cáo chẩn đoán", icon: "description", disabled: true },
];

const footerItems: NavItem[] = [
  // { href: "#", label: "Hỗ trợ kỹ thuật", icon: "support_agent" },
];

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
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>OsteoScan DXA</div>

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
              <h2 className={styles.clinicTitle}>Trung tâm Y tế</h2>
              <p className={styles.clinicSubtitle}>Khoa chẩn đoán hình ảnh</p>
            </div>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const className = isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink;

              if (item.disabled) {
                return (
                  <span key={item.href} className={className} aria-disabled="true">
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                );
              }

              return (
                <Link key={item.href} href={item.href} className={className}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className={styles.sidebarFooter}>
            {footerItems.map((item) => (
              <Link key={item.label} href={item.href} className={styles.navLink}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            <button type="button" className={styles.navLink} onClick={logout}>
              <span className="material-symbols-outlined">logout</span>
              <span>Đăng xuất</span>
            </button>
          </div>
        </aside>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

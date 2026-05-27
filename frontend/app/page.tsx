"use client";

import { useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { DashboardShell } from "@/components/layouts/DashboardShell";

import DashboardView from "@/app/components/views/DashboardView";
import UploadView from "@/app/components/views/UploadView";
import MeasurementView from "@/app/components/views/MeasurementView";

export default function AppRouterPage() {
  const [currentView, setCurrentView] = useState("dashboard");

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <DashboardView />;
      case "upload":
        return <UploadView />;
      case "measurement":
        return <MeasurementView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <ProtectedRoute>
      <DashboardShell currentView={currentView} onViewChange={setCurrentView}>
        {renderView()}
      </DashboardShell>
    </ProtectedRoute>
  );
}

"use client";

import { useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { DashboardShell } from "@/components/layouts/DashboardShell";
import { useAuth } from "@/app/context/AuthContext";

import DashboardView from "@/app/components/views/DashboardView";
import UploadView from "@/app/components/views/UploadView";
import MeasurementView from "@/app/components/views/MeasurementView";
import TrainingView from "@/app/components/views/TrainingView";

export default function AppRouterPage() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedMeasurement, setSelectedMeasurement] = useState<any>(null);

  const isPrivileged = user && (user.role === "admin" || user.role === "doctor");
  const isAdmin = user && user.role === "admin";

  const handleViewChange = (view: string) => {
    if (view === "upload" && !isPrivileged) {
      return;
    }
    if (view === "training" && !isAdmin) {
      return;
    }
    if (view !== "measurement") {
      setSelectedMeasurement(null);
    }
    setCurrentView(view);
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <DashboardView 
            onViewChange={handleViewChange} 
            onSelectMeasurement={(meas) => {
              setSelectedMeasurement(meas);
              setCurrentView("measurement");
            }} 
          />
        );
      case "upload":
        return isPrivileged ? <UploadView /> : <DashboardView onViewChange={handleViewChange} />;
      case "training":
        return isAdmin ? <TrainingView /> : <DashboardView onViewChange={handleViewChange} />;
      case "measurement":
        return (
          <MeasurementView 
            initialResultData={selectedMeasurement} 
            onClearInitial={() => setSelectedMeasurement(null)} 
          />
        );
      default:
        return <DashboardView onViewChange={handleViewChange} />;
    }
  };

  return (
    <ProtectedRoute>
      <DashboardShell currentView={currentView} onViewChange={handleViewChange}>
        {renderView()}
      </DashboardShell>
    </ProtectedRoute>
  );
}


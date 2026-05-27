"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isAuthenticated) {
      window.location.replace("/dashboard");
    } else {
      window.location.replace("/login");
    }
  }, [isAuthenticated, isLoading]);

  return null;
}

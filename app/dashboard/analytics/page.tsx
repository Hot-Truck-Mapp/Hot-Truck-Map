"use client";
import { useEffect } from "react";
export default function AnalyticsRedirect() {
  useEffect(() => { window.location.replace("/dashboard"); }, []);
  return null;
}

"use client";
import { useEffect } from "react";
export default function ScheduleRedirect() {
  useEffect(() => { window.location.replace("/dashboard"); }, []);
  return null;
}

"use client";
import { useEffect } from "react";
export default function ProfileRedirect() {
  useEffect(() => { window.location.replace("/dashboard"); }, []);
  return null;
}

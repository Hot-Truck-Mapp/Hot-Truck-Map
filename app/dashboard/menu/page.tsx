"use client";
import { useEffect } from "react";
export default function MenuRedirect() {
  useEffect(() => { window.location.replace("/dashboard"); }, []);
  return null;
}

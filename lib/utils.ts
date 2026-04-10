import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isLive(broadcasted_at: string | null): boolean {
  if (!broadcasted_at) return false
  const diff = Date.now() - new Date(broadcasted_at).getTime()
  return diff < 1000 * 60 * 30 // live if updated within 30 minutes
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Data access ───────────────────────────────────────────────────────────
// Every admin read goes through /api/admin/data (service role, owner-gated)
// and every write through /api/admin/action. The browser never queries these
// tables directly — RLS blocks it, and that's deliberate.

export async function fetchSection<T>(section: string): Promise<T> {
  const res = await fetch(`/api/admin/data?section=${encodeURIComponent(section)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? `Failed to load ${section}`);
  }
  return res.json();
}

export async function adminAction(
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await fetch("/api/admin/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? "Action failed");
  }
}

/**
 * Loads one dashboard section, and re-loads it when `refreshToken` changes
 * (the header's Refresh button bumps it). Fetches lazily — a section is only
 * requested once its tab is opened, so opening the dashboard doesn't pull the
 * whole database.
 */
export function useAdminSection<T>(section: string, refreshToken: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchSection<T>(section);
      if (mountedRef.current) setData(json);
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to load");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [section]);

  useEffect(() => { void reload(); }, [reload, refreshToken]);

  return { data, loading, error, reload };
}

// ── Formatting ────────────────────────────────────────────────────────────

export const money = (n: number | string | null | undefined) =>
  `$${Number(n ?? 0).toFixed(2)}`;

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString([], {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(iso);
}

// ── Presentational primitives ─────────────────────────────────────────────

export function PanelHeader({
  title, count, children,
}: { title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
      <p className="text-sm font-black text-neutral-500 uppercase tracking-widest">
        {title}
        {count !== undefined && <span className="text-neutral-300 ml-2">{count}</span>}
      </p>
      {children}
    </div>
  );
}

export function PanelState({
  loading, error, empty, emptyLabel, onRetry,
}: {
  loading: boolean; error: string | null; empty: boolean;
  emptyLabel: string; onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="py-14 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm font-semibold text-red-500 mb-3">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
  if (empty) {
    return <p className="py-14 text-center text-neutral-400 text-sm">{emptyLabel}</p>;
  }
  return null;
}

const PILL_TONES: Record<string, string> = {
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  neutral: "bg-neutral-100 text-neutral-500",
};

export function Pill({
  label, tone = "neutral",
}: { label: string; tone?: keyof typeof PILL_TONES }) {
  return (
    <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${PILL_TONES[tone]}`}>
      {label}
    </span>
  );
}

export function SearchInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red w-full sm:w-64"
    />
  );
}

/** Small text button used for row actions. `tone="danger"` for destructive ones. */
export function RowButton({
  label, onClick, tone = "default", disabled,
}: { label: string; onClick: () => void; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 ${
        tone === "danger"
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}

/** Horizontal-scroll wrapper so wide tables never widen the page. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto -mx-6 px-6">{children}</div>;
}

/**
 * Triggers a client-side CSV download. Used for the newsletter and user
 * exports — the data is already in the browser, so no extra endpoint needed.
 */
export function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const escape = (cell: string | number | null) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  adminAction, dateTime, PanelHeader, PanelState, RowButton,
  SearchInput, useAdminSection,
} from "./shared";

type Review = {
  id: string;
  truck_id: string | null;
  truck_name: string | null;
  author_email: string | null;
  rating: number;
  text: string | null;
  created_at: string;
};

export default function ReviewsPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } = useAdminSection<{ reviews: Review[] }>("reviews", refreshToken);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reviews = data?.reviews ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      // 1–2 stars is where complaints and abuse cluster — the first thing
      // worth looking at when moderating.
      if (lowOnly && r.rating > 2) return false;
      if (!q) return true;
      return (
        (r.truck_name ?? "").toLowerCase().includes(q) ||
        (r.text ?? "").toLowerCase().includes(q) ||
        (r.author_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [reviews, query, lowOnly]);

  async function remove(r: Review) {
    if (!window.confirm("Delete this review? The truck's rating will recalculate.")) return;
    setBusyId(r.id);
    setActionError(null);
    try {
      await adminAction("review.delete", { id: r.id });
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to delete review");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <PanelHeader title="Reviews" count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setLowOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              lowOnly ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            1–2 stars only
          </button>
          <SearchInput value={query} onChange={setQuery} placeholder="Truck, text or author…" />
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        emptyLabel={reviews.length === 0 ? "No reviews yet." : "Nothing matches this filter."}
        onRetry={reload}
      />

      <div className="flex flex-col gap-2">
        {!loading && !error && filtered.map((r) => (
          <div key={r.id} className="border border-neutral-100 rounded-2xl p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-amber-500 text-sm tracking-tight" aria-label={`${r.rating} out of 5 stars`}>
                  {"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}
                </span>
                <p className="font-bold text-neutral-800 text-sm">
                  {r.truck_id
                    ? <Link href={`/truck/${r.truck_id}`} target="_blank" className="hover:text-brand-red">{r.truck_name ?? "Unknown truck"}</Link>
                    : (r.truck_name ?? "Unknown truck")}
                </p>
              </div>
              {r.text && <p className="text-sm text-neutral-600">{r.text}</p>}
              <p className="text-[11px] text-neutral-400 mt-1.5 break-all">
                {r.author_email ?? "deleted account"} · {dateTime(r.created_at)}
              </p>
            </div>
            <RowButton
              label="Delete"
              tone="danger"
              disabled={busyId === r.id}
              onClick={() => void remove(r)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

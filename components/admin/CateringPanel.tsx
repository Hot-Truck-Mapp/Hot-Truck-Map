"use client";

import { useMemo, useState } from "react";
import {
  adminAction, money, PanelHeader, PanelState, Pill, SearchInput,
  shortDate, timeAgo, useAdminSection,
} from "./shared";

type CateringRequest = {
  id: string;
  truck_name: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  event_date: string;
  event_time: string | null;
  event_location: string;
  guest_count: number;
  budget: number | null;
  event_type: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["pending", "accepted", "declined", "completed", "cancelled"] as const;

const STATUS_TONE: Record<string, "green" | "red" | "amber" | "blue" | "neutral"> = {
  pending: "amber",
  accepted: "blue",
  completed: "green",
  declined: "red",
  cancelled: "red",
};

export default function CateringPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } =
    useAdminSection<{ requests: CateringRequest[] }>("catering", refreshToken);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requests = data?.requests ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.customer_name.toLowerCase().includes(q) ||
        r.customer_email.toLowerCase().includes(q) ||
        (r.truck_name ?? "").toLowerCase().includes(q) ||
        r.event_location.toLowerCase().includes(q)
      );
    });
  }, [requests, query, statusFilter]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await adminAction("catering.status", { id, status });
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to update request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <PanelHeader title="Catering requests" count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 bg-white focus:outline-none focus:border-brand-red"
          >
            <option value="pending">Needs a reply</option>
            <option value="all">All</option>
            {STATUSES.filter((s) => s !== "pending").map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder="Name, email, truck…" />
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        emptyLabel={requests.length === 0 ? "No catering requests yet." : "Nothing matches this filter."}
        onRetry={reload}
      />

      <div className="flex flex-col gap-3">
        {!loading && !error && filtered.map((r) => (
          <div key={r.id} className="border border-neutral-100 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-black text-neutral-800">{r.customer_name}</p>
                  <Pill label={r.status} tone={STATUS_TONE[r.status] ?? "neutral"} />
                </div>
                <p className="text-xs text-neutral-400">
                  {r.truck_name ? `for ${r.truck_name} · ` : ""}received {timeAgo(r.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUSES.filter((s) => s !== r.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(r.id, s)}
                    disabled={busyId === r.id}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 text-[11px] font-bold hover:bg-neutral-200 transition-colors disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <Field label="Event date" value={`${shortDate(r.event_date)}${r.event_time ? ` · ${r.event_time}` : ""}`} />
              <Field label="Guests" value={String(r.guest_count)} />
              <Field label="Budget" value={r.budget != null ? money(r.budget) : "—"} />
              <Field label="Type" value={r.event_type ?? "—"} />
            </div>

            <Field label="Location" value={r.event_location} />

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <a href={`mailto:${r.customer_email}`} className="text-xs font-bold text-brand-red hover:underline break-all">
                {r.customer_email}
              </a>
              {r.customer_phone && (
                <a href={`tel:${r.customer_phone}`} className="text-xs font-bold text-brand-red hover:underline">
                  {r.customer_phone}
                </a>
              )}
            </div>

            {r.notes && (
              <p className="text-sm text-neutral-600 mt-3 bg-neutral-50 rounded-xl p-3 whitespace-pre-wrap">{r.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-neutral-700 font-semibold">{value}</p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  adminAction, downloadCsv, PanelHeader, PanelState, Pill, RowButton,
  SearchInput, shortDate, TableScroll, useAdminSection,
} from "./shared";

export type AdminTruck = {
  id: string;
  name: string;
  cuisine: string | null;
  cuisine_type: string | null;
  is_live: boolean;
  is_active: boolean | null;
  phone: string | null;
  instagram: string | null;
  avg_rating: number | null;
  review_count: number | null;
  owner_id: string | null;
  owner_email: string | null;
  address: string | null;
  offers_catering: boolean | null;
  followers: number;
  created_at: string;
};

export default function TrucksPanel({
  refreshToken, liveOnly = false,
}: { refreshToken: number; liveOnly?: boolean }) {
  const { data, loading, error, reload } =
    useAdminSection<{ trucks: AdminTruck[] }>("trucks", refreshToken);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "followers" | "rating" | "name">("newest");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const trucks = data?.trucks ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = trucks.filter((t) => {
      if (liveOnly && !t.is_live) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.cuisine ?? t.cuisine_type ?? "").toLowerCase().includes(q) ||
        (t.owner_email ?? "").toLowerCase().includes(q)
      );
    });
    const sorted = [...rows];
    switch (sort) {
      case "followers": sorted.sort((a, b) => b.followers - a.followers); break;
      case "rating": sorted.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)); break;
      case "name": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    return sorted;
  }, [trucks, query, sort, liveOnly]);

  async function run(action: string, payload: Record<string, unknown>, id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await adminAction(action, payload);
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    downloadCsv("hot-truck-map-trucks.csv", [
      ["name", "cuisine", "owner_email", "phone", "instagram", "followers", "rating", "reviews", "live", "hidden", "created_at"],
      ...filtered.map((t) => [
        t.name, t.cuisine ?? t.cuisine_type ?? "", t.owner_email ?? "", t.phone ?? "",
        t.instagram ?? "", t.followers, t.avg_rating ?? "", t.review_count ?? 0,
        t.is_live ? "yes" : "no", t.is_active === false ? "yes" : "no", t.created_at,
      ]),
    ]);
  }

  return (
    <div className="p-6">
      <PanelHeader title={liveOnly ? "Live right now" : "All trucks"} count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          {!liveOnly && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 bg-white focus:outline-none focus:border-brand-red"
            >
              <option value="newest">Newest first</option>
              <option value="followers">Most followers</option>
              <option value="rating">Highest rated</option>
              <option value="name">Name A–Z</option>
            </select>
          )}
          <SearchInput value={query} onChange={setQuery} placeholder="Truck, cuisine or owner…" />
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        emptyLabel={liveOnly ? "No trucks are broadcasting right now." : "No trucks match this filter."}
        onRetry={reload}
      />

      {!loading && !error && filtered.length > 0 && (
        <TableScroll>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                <th className="py-2.5 pr-4">Truck</th>
                <th className="py-2.5 pr-4">Owner</th>
                <th className="py-2.5 pr-4">Followers</th>
                <th className="py-2.5 pr-4">Rating</th>
                <th className="py-2.5 pr-4">Joined</th>
                <th className="py-2.5 pr-4">State</th>
                <th className="py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-neutral-50 align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/truck/${t.id}`} target="_blank" className="font-semibold text-neutral-800 hover:text-brand-red">
                      {t.name}
                    </Link>
                    <div className="text-xs text-neutral-400">{t.cuisine ?? t.cuisine_type ?? "—"}</div>
                    {t.address && <div className="text-xs text-neutral-400">{t.address}</div>}
                  </td>
                  <td className="py-3 pr-4 text-neutral-600">
                    {t.owner_email
                      ? <a href={`mailto:${t.owner_email}`} className="hover:text-brand-red break-all">{t.owner_email}</a>
                      : <span className="text-neutral-300">no owner</span>}
                    {t.phone && <div className="text-xs text-neutral-400">{t.phone}</div>}
                  </td>
                  <td className="py-3 pr-4 font-black text-neutral-800">{t.followers}</td>
                  <td className="py-3 pr-4 text-neutral-600 whitespace-nowrap">
                    {t.avg_rating ? `★ ${Number(t.avg_rating).toFixed(1)}` : "—"}
                    <span className="text-xs text-neutral-400"> ({t.review_count ?? 0})</span>
                  </td>
                  <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap">{shortDate(t.created_at)}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1 items-start">
                      {t.is_live ? <Pill label="live" tone="green" /> : <Pill label="offline" tone="neutral" />}
                      {t.is_active === false && <Pill label="hidden" tone="red" />}
                      {t.offers_catering && <Pill label="catering" tone="blue" />}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Forcing a stuck pin offline is the most common support fix. */}
                      <RowButton
                        label={t.is_live ? "Force offline" : "Set live"}
                        disabled={busyId === t.id}
                        onClick={() => void run("truck.live", { id: t.id, value: !t.is_live }, t.id)}
                      />
                      <RowButton
                        label={t.is_active === false ? "Unhide" : "Hide"}
                        disabled={busyId === t.id}
                        onClick={() => void run("truck.active", { id: t.id, value: t.is_active === false }, t.id)}
                      />
                      <RowButton
                        label="Delete"
                        tone="danger"
                        disabled={busyId === t.id}
                        onClick={() => {
                          if (window.confirm(
                            `Permanently delete "${t.name}"?\n\nThis also removes its menu, schedule, reviews, photos and order history. Hiding it is usually the better option.`
                          )) void run("truck.delete", { id: t.id }, t.id);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}

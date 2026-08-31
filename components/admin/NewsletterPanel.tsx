"use client";

import { useMemo, useState } from "react";
import {
  adminAction, dateTime, downloadCsv, PanelHeader, PanelState, Pill,
  RowButton, SearchInput, TableScroll, useAdminSection,
} from "./shared";

type Subscriber = {
  id: string;
  email: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export default function NewsletterPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } =
    useAdminSection<{ subscribers: Subscriber[] }>("newsletter", refreshToken);
  const [query, setQuery] = useState("");
  const [showUnsubscribed, setShowUnsubscribed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const subscribers = data?.subscribers ?? [];
  const activeCount = subscribers.filter((s) => !s.unsubscribed_at).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (!showUnsubscribed && s.unsubscribed_at) return false;
      if (!q) return true;
      return s.email.toLowerCase().includes(q);
    });
  }, [subscribers, query, showUnsubscribed]);

  function exportCsv() {
    // Active subscribers only — this list is what gets pasted into the email
    // sender, and mailing someone who unsubscribed is exactly what the
    // unsubscribe link promised wouldn't happen.
    const active = filtered.filter((s) => !s.unsubscribed_at);
    downloadCsv("hot-truck-map-newsletter.csv", [
      ["email", "subscribed_at"],
      ...active.map((s) => [s.email, s.subscribed_at]),
    ]);
  }

  async function unsubscribe(s: Subscriber) {
    if (!window.confirm(`Unsubscribe ${s.email}?`)) return;
    setBusyId(s.id);
    setActionError(null);
    try {
      await adminAction("newsletter.unsubscribe", { id: s.id });
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to unsubscribe");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <PanelHeader title="Newsletter subscribers" count={activeCount}>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowUnsubscribed((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              showUnsubscribed ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {showUnsubscribed ? "Showing unsubscribed" : "Active only"}
          </button>
          <SearchInput value={query} onChange={setQuery} placeholder="Email…" />
          <button
            onClick={exportCsv}
            disabled={activeCount === 0}
            className="px-3 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors disabled:opacity-40"
          >
            Export active CSV
          </button>
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        emptyLabel={subscribers.length === 0 ? "No subscribers yet." : "Nothing matches this filter."}
        onRetry={reload}
      />

      {!loading && !error && filtered.length > 0 && (
        <TableScroll>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                <th className="py-2.5 pr-4">Email</th>
                <th className="py-2.5 pr-4">Subscribed</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-neutral-50">
                  <td className="py-3 pr-4 font-semibold text-neutral-800 break-all">{s.email}</td>
                  <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap">{dateTime(s.subscribed_at)}</td>
                  <td className="py-3 pr-4">
                    {s.unsubscribed_at
                      ? <Pill label="unsubscribed" tone="neutral" />
                      : <Pill label="active" tone="green" />}
                  </td>
                  <td className="py-3">
                    {!s.unsubscribed_at && (
                      <RowButton
                        label="Unsubscribe"
                        disabled={busyId === s.id}
                        onClick={() => void unsubscribe(s)}
                      />
                    )}
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

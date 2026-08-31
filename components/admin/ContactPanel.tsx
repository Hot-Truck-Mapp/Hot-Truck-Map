"use client";

import { useMemo, useState } from "react";
import {
  adminAction, dateTime, PanelHeader, PanelState, Pill, RowButton,
  SearchInput, useAdminSection,
} from "./shared";

type Submission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  handled_at: string | null;
  created_at: string;
};

export default function ContactPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } =
    useAdminSection<{ submissions: Submission[] }>("contact", refreshToken);
  const [query, setQuery] = useState("");
  const [showHandled, setShowHandled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const submissions = data?.submissions ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((s) => {
      if (!showHandled && s.handled_at) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.message.toLowerCase().includes(q)
      );
    });
  }, [submissions, query, showHandled]);

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

  return (
    <div className="p-6">
      <PanelHeader title="Contact inbox" count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowHandled((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
              showHandled ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {showHandled ? "Showing handled" : "Hiding handled"}
          </button>
          <SearchInput value={query} onChange={setQuery} placeholder="Name, email, message…" />
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        emptyLabel={
          submissions.length === 0
            ? "No contact messages yet."
            : "Inbox zero — nothing left to handle."
        }
        onRetry={reload}
      />

      <div className="flex flex-col gap-3">
        {!loading && !error && filtered.map((s) => (
          <div
            key={s.id}
            className={`border rounded-2xl p-4 ${s.handled_at ? "border-neutral-100 bg-neutral-50/60" : "border-neutral-200"}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-black text-neutral-800">{s.subject}</p>
                  {s.handled_at ? <Pill label="handled" tone="green" /> : <Pill label="new" tone="amber" />}
                </div>
                <p className="text-xs text-neutral-400">
                  {s.name} · <a href={`mailto:${s.email}`} className="text-brand-red font-semibold hover:underline break-all">{s.email}</a> · {dateTime(s.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`mailto:${s.email}?subject=${encodeURIComponent(`Re: ${s.subject}`)}`}
                  className="px-2.5 py-1 rounded-lg bg-brand-red text-white text-[11px] font-bold hover:bg-red-600 transition-colors"
                >
                  Reply
                </a>
                <RowButton
                  label={s.handled_at ? "Reopen" : "Mark handled"}
                  disabled={busyId === s.id}
                  onClick={() => run("contact.handled", { id: s.id, value: !s.handled_at }, s.id)}
                />
                <RowButton
                  label="Delete"
                  tone="danger"
                  disabled={busyId === s.id}
                  onClick={() => {
                    if (window.confirm("Delete this message permanently?")) {
                      void run("contact.delete", { id: s.id }, s.id);
                    }
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-neutral-600 whitespace-pre-wrap">{s.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

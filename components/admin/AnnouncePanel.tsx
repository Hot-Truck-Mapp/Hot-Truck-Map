"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dateTime, PanelHeader, Pill, TableScroll } from "./shared";

type Audience = "all" | "operators" | "customers";

type Preview = { recipients: number; reachable: number; optedOut: number };

type Announcement = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  audience: string;
  sent_by_email: string | null;
  recipients: number;
  devices: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

type SendResult = {
  sent: number;
  failed: number;
  recipients: number;
  devices: number;
  optedOut: number;
  note?: string;
  logged?: boolean;
};

const TITLE_MAX = 80;
const BODY_MAX = 200;

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "Everyone",
  operators: "Operators only",
  customers: "Customers only",
};

/**
 * Owner-only push broadcast. Deliberately friction-heavy: the reach is shown
 * before sending, the send button is disabled until the audience has actually
 * been costed, and the confirm step names the number of people involved.
 * A push notification can't be recalled.
 */
export default function AnnouncePanel({ refreshToken }: { refreshToken: number }) {
  const mountedRef = useRef(true);

  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [history, setHistory] = useState<Announcement[]>([]);
  const [patchApplied, setPatchApplied] = useState(true);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (forAudience: Audience) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/announce?audience=${forAudience}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to load");
      const json = await res.json();
      if (!mountedRef.current) return;
      setPreview(json.preview ?? null);
      setHistory(json.history ?? []);
      setPatchApplied(json.patchApplied !== false);
      setError(null);
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to load audience");
    } finally {
      if (mountedRef.current) setPreviewLoading(false);
    }
  }, []);

  useEffect(() => { void load(audience); }, [load, audience, refreshToken]);

  const titleOk = title.trim().length > 0 && title.length <= TITLE_MAX;
  const bodyOk = body.trim().length > 0 && body.length <= BODY_MAX;
  const linkOk = !link.trim() || (link.trim().startsWith("/") && !link.trim().startsWith("//"));
  const canSend = titleOk && bodyOk && linkOk && !previewLoading && !sending && (preview?.reachable ?? 0) > 0;

  async function send() {
    if (!canSend || !preview) return;

    const confirmed = window.confirm(
      `Send this announcement to ${preview.recipients} ` +
      `${preview.recipients === 1 ? "person" : "people"} (${preview.reachable} ` +
      `${preview.reachable === 1 ? "device" : "devices"})?\n\n` +
      `${title}\n${body}\n\n` +
      `Push notifications can't be recalled once sent.`
    );
    if (!confirmed) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: link.trim() || null,
          audience,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to send announcement");
      if (!mountedRef.current) return;
      setResult(json);
      setTitle("");
      setBody("");
      setLink("");
      await load(audience);
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to send announcement");
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red";
  const labelClass =
    "text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5";

  return (
    <div className="p-6">
      <PanelHeader title="Send an announcement" />

      {!patchApplied && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-5">
          <p className="text-sm font-semibold text-amber-800">
            Run supabase_patch_011.sql to enable the send history.
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Announcements will still send — they just won&apos;t be logged until the patch is applied.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* ── Compose ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Audience</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    audience === a
                      ? "bg-brand-red text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {AUDIENCE_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${labelClass} mb-0`}>Title</label>
              <span className={`text-[11px] font-semibold ${title.length > TITLE_MAX ? "text-red-500" : "text-neutral-300"}`}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="e.g. 12 new trucks joined this week"
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${labelClass} mb-0`}>Message</label>
              <span className={`text-[11px] font-semibold ${body.length > BODY_MAX ? "text-red-500" : "text-neutral-300"}`}>
                {body.length}/{BODY_MAX}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={BODY_MAX}
              placeholder="Keep it short — most phones cut off around two lines."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>
              Opens <span className="normal-case text-neutral-300">(optional)</span>
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/events"
              className={inputClass}
            />
            <p className={`text-[11px] mt-1 ${linkOk ? "text-neutral-400" : "text-red-500 font-semibold"}`}>
              {linkOk
                ? "A path on this site. Leave blank to open the homepage."
                : "Must be a path starting with a single /"}
            </p>
          </div>
        </div>

        {/* ── Preview + reach ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Preview</label>
            <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-red flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-neutral-800 break-words">
                    {title.trim() || "Your title appears here"}
                  </p>
                  <p className="text-sm text-neutral-600 break-words">
                    {body.trim() || "And the message body here."}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Hot Truck Map · opens {link.trim() || "/"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Reach</label>
            <div className="border border-neutral-200 rounded-2xl p-4">
              {previewLoading ? (
                <p className="text-sm text-neutral-400">Counting…</p>
              ) : preview ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label="People" value={preview.recipients} />
                    <Stat label="Devices" value={preview.reachable} />
                    <Stat label="Opted out" value={preview.optedOut} />
                  </div>
                  {preview.reachable === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mt-3">
                      Nobody in this audience has push notifications turned on, so there is
                      nothing to send yet.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-400">Unavailable.</p>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          {result ? (
            <div className="bg-green-50 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-green-700">
                {result.note ?? `Delivered to ${result.sent} of ${result.devices} devices.`}
              </p>
              {result.failed > 0 && (
                <p className="text-xs text-green-700/80 mt-0.5">
                  {result.failed} failed — usually devices that uninstalled or revoked permission.
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={send}
              disabled={!canSend}
              className="py-3 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-40 hover:bg-red-600 transition-colors active:scale-95"
            >
              {sending ? "Sending…" : `Send to ${AUDIENCE_LABELS[audience].toLowerCase()}`}
            </button>
          )}
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────────────── */}
      <p className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-3">
        Sent history
      </p>
      {history.length === 0 ? (
        <p className="py-10 text-center text-neutral-400 text-sm border border-neutral-100 rounded-xl">
          Nothing sent yet.
        </p>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                <th className="py-2.5 pr-4">Sent</th>
                <th className="py-2.5 pr-4">Announcement</th>
                <th className="py-2.5 pr-4">Audience</th>
                <th className="py-2.5 pr-4">Delivered</th>
                <th className="py-2.5">By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className="border-b border-neutral-50 align-top">
                  <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap">{dateTime(a.created_at)}</td>
                  <td className="py-3 pr-4 max-w-[280px]">
                    <p className="font-semibold text-neutral-800">{a.title}</p>
                    <p className="text-xs text-neutral-500">{a.body}</p>
                    {a.url && <p className="text-[11px] text-neutral-400 mt-0.5">opens {a.url}</p>}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill label={a.audience} tone="blue" />
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span className="font-black text-neutral-800">{a.sent_count}</span>
                    <span className="text-neutral-400"> / {a.devices}</span>
                    {a.failed_count > 0 && (
                      <div className="text-[11px] text-red-500 font-semibold">{a.failed_count} failed</div>
                    )}
                  </td>
                  <td className="py-3 text-neutral-500 break-all">{a.sent_by_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-neutral-800">{value.toLocaleString()}</p>
    </div>
  );
}

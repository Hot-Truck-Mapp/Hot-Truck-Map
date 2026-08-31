"use client";

import { useState } from "react";
import Link from "next/link";
import {
  adminAction, PanelHeader, PanelState, RowButton, timeAgo, useAdminSection,
} from "./shared";

type SpottedPost = {
  id: string;
  truck_id: string | null;
  truck_name: string | null;
  author_email: string | null;
  location: string | null;
  note: string | null;
  created_at: string;
};

type TruckPhoto = {
  id: string;
  truck_id: string | null;
  truck_name: string | null;
  author_email: string | null;
  photo_url: string;
  created_at: string;
};

type Reply = { spotted: SpottedPost[]; photos: TruckPhoto[] };

/**
 * Community content moderation: "spotted" reports and user-uploaded truck
 * photos. Both are public the moment they're posted, so this is the only
 * place abusive or wrong content can be taken down platform-wide.
 */
export default function ModerationPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } = useAdminSection<Reply>("moderation", refreshToken);
  const [view, setView] = useState<"spotted" | "photos">("spotted");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const spotted = data?.spotted ?? [];
  const photos = data?.photos ?? [];
  const rows = view === "spotted" ? spotted : photos;

  async function remove(action: string, id: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusyId(id);
    setActionError(null);
    try {
      await adminAction(action, { id });
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <PanelHeader title="Community content" count={rows.length}>
        <div className="flex items-center gap-1.5">
          {(["spotted", "photos"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                view === v ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {v === "spotted" ? `Spotted (${spotted.length})` : `Photos (${photos.length})`}
            </button>
          ))}
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel={view === "spotted" ? "No spotted reports yet." : "No community photos yet."}
        onRetry={reload}
      />

      {!loading && !error && view === "spotted" && spotted.length > 0 && (
        <div className="flex flex-col gap-2">
          {spotted.map((s) => (
            <div key={s.id} className="border border-neutral-100 rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-neutral-800 text-sm">
                  {s.truck_id
                    ? <Link href={`/truck/${s.truck_id}`} target="_blank" className="hover:text-brand-red">{s.truck_name ?? "Unknown truck"}</Link>
                    : (s.truck_name ?? "Unknown truck")}
                </p>
                {s.location && <p className="text-xs text-neutral-500 mt-0.5">{s.location}</p>}
                {s.note && <p className="text-sm text-neutral-600 mt-1.5">{s.note}</p>}
                <p className="text-[11px] text-neutral-400 mt-1.5 break-all">
                  {s.author_email ?? "deleted account"} · {timeAgo(s.created_at)}
                </p>
              </div>
              <RowButton
                label="Delete"
                tone="danger"
                disabled={busyId === s.id}
                onClick={() => void remove("spotted.delete", s.id, "Delete this spotted report?")}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && view === "photos" && photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="border border-neutral-100 rounded-2xl overflow-hidden">
              {/* Plain <img>: these are arbitrary user-supplied URLs, which
                  next/image would need every host allow-listed for. */}
              <img
                src={p.photo_url}
                alt={`Community photo of ${p.truck_name ?? "a truck"}`}
                className="w-full h-32 object-cover bg-neutral-100"
                loading="lazy"
              />
              <div className="p-3">
                <p className="text-xs font-bold text-neutral-700 truncate">{p.truck_name ?? "Unknown truck"}</p>
                <p className="text-[11px] text-neutral-400 truncate">{p.author_email ?? "deleted account"}</p>
                <p className="text-[11px] text-neutral-400 mb-2">{timeAgo(p.created_at)}</p>
                <RowButton
                  label="Delete"
                  tone="danger"
                  disabled={busyId === p.id}
                  onClick={() => void remove("photo.delete", p.id, "Delete this photo?")}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

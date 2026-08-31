"use client";

import { useMemo, useState } from "react";
import {
  adminAction, dateTime, downloadCsv, PanelHeader, PanelState, Pill,
  RowButton, SearchInput, TableScroll, timeAgo, useAdminSection,
} from "./shared";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  truck_name: string | null;
  role: "operator" | "customer";
};

export default function UsersPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } = useAdminSection<{ users: AdminUser[] }>("users", refreshToken);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const users = data?.users ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter === "operator" && u.role !== "operator") return false;
      if (roleFilter === "customer" && u.role !== "customer") return false;
      if (roleFilter === "unconfirmed" && u.email_confirmed_at) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.truck_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, roleFilter]);

  async function deleteUser(u: AdminUser) {
    if (!window.confirm(
      `Permanently delete ${u.email}?\n\nThis removes their account and everything cascading from it` +
      `${u.truck_name ? ` — including the truck "${u.truck_name}"` : ""}. This can't be undone.`
    )) return;
    setBusyId(u.id);
    setActionError(null);
    try {
      await adminAction("user.delete", { id: u.id });
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to delete user");
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    downloadCsv("hot-truck-map-users.csv", [
      ["email", "role", "truck", "signed_up", "last_sign_in", "email_confirmed"],
      ...filtered.map((u) => [
        u.email, u.role, u.truck_name ?? "", u.created_at,
        u.last_sign_in_at ?? "", u.email_confirmed_at ? "yes" : "no",
      ]),
    ]);
  }

  return (
    <div className="p-6">
      <PanelHeader title="Accounts" count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 bg-white focus:outline-none focus:border-brand-red"
          >
            <option value="all">Everyone</option>
            <option value="operator">Operators</option>
            <option value="customer">Customers</option>
            <option value="unconfirmed">Unconfirmed email</option>
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder="Email or truck…" />
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
        emptyLabel={users.length === 0 ? "No accounts yet." : "No accounts match this filter."}
        onRetry={reload}
      />

      {!loading && !error && filtered.length > 0 && (
        <TableScroll>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                <th className="py-2.5 pr-4">Email</th>
                <th className="py-2.5 pr-4">Role</th>
                <th className="py-2.5 pr-4">Truck</th>
                <th className="py-2.5 pr-4">Signed up</th>
                <th className="py-2.5 pr-4">Last seen</th>
                <th className="py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-neutral-50">
                  <td className="py-3 pr-4">
                    <span className="font-semibold text-neutral-800 break-all">{u.email ?? "—"}</span>
                    {!u.email_confirmed_at && (
                      <span className="ml-2 inline-block align-middle"><Pill label="unconfirmed" tone="amber" /></span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill label={u.role} tone={u.role === "operator" ? "blue" : "neutral"} />
                  </td>
                  <td className="py-3 pr-4 text-neutral-600">{u.truck_name ?? "—"}</td>
                  <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap">{dateTime(u.created_at)}</td>
                  <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap">{timeAgo(u.last_sign_in_at)}</td>
                  <td className="py-3">
                    <RowButton
                      label="Delete"
                      tone="danger"
                      disabled={busyId === u.id}
                      onClick={() => void deleteUser(u)}
                    />
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

"use client";

import { useMemo, useState } from "react";
import {
  adminAction, dateTime, money, PanelHeader, PanelState, Pill,
  SearchInput, TableScroll, useAdminSection,
} from "./shared";

type Order = {
  id: string;
  truck_id: string | null;
  truck_name: string | null;
  customer_email: string | null;
  pickup_name: string | null;
  items: { name: string; quantity: number; price: number }[] | null;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["pending", "preparing", "ready", "picked_up", "no_show", "cancelled"] as const;

const STATUS_TONE: Record<string, "green" | "red" | "amber" | "blue" | "neutral"> = {
  pending: "amber",
  preparing: "blue",
  ready: "green",
  picked_up: "neutral",
  no_show: "red",
  cancelled: "red",
};

export default function OrdersPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } = useAdminSection<{ orders: Order[] }>("orders", refreshToken);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const orders = data?.orders ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter === "open" && !["pending", "preparing", "ready"].includes(o.status)) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (o.truck_name ?? "").toLowerCase().includes(q) ||
        (o.pickup_name ?? "").toLowerCase().includes(q) ||
        (o.customer_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter]);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await adminAction("order.status", { id, status });
      await reload();
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to update order");
    } finally {
      setBusyId(null);
    }
  }

  const revenue = filtered
    .filter((o) => o.status !== "cancelled" && o.status !== "no_show")
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0);

  return (
    <div className="p-6">
      <PanelHeader title="Orders" count={filtered.length}>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-700 bg-white focus:outline-none focus:border-brand-red"
          >
            <option value="open">Open orders</option>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <SearchInput value={query} onChange={setQuery} placeholder="Truck, name or email…" />
        </div>
      </PanelHeader>

      {actionError && <p className="text-xs text-red-500 font-semibold mb-3">{actionError}</p>}

      <PanelState
        loading={loading}
        error={error}
        empty={filtered.length === 0}
        emptyLabel={orders.length === 0 ? "No orders yet." : "No orders match this filter."}
        onRetry={reload}
      />

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="bg-neutral-50 rounded-xl px-4 py-3 mb-4 flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Shown</p>
              <p className="text-lg font-black text-neutral-800">{filtered.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Value</p>
              <p className="text-lg font-black text-neutral-800">{money(revenue)}</p>
            </div>
          </div>

          <TableScroll>
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                  <th className="py-2.5 pr-4">Placed</th>
                  <th className="py-2.5 pr-4">Truck</th>
                  <th className="py-2.5 pr-4">Customer</th>
                  <th className="py-2.5 pr-4">Items</th>
                  <th className="py-2.5 pr-4">Total</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Change to</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-50 align-top">
                    <td className="py-3 pr-4 text-neutral-500 whitespace-nowrap">{dateTime(o.created_at)}</td>
                    <td className="py-3 pr-4 font-semibold text-neutral-800">{o.truck_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-neutral-600">
                      <div className="font-semibold">{o.pickup_name ?? "—"}</div>
                      {o.customer_email && (
                        <div className="text-xs text-neutral-400 break-all">{o.customer_email}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-neutral-600 max-w-[220px]">
                      {(o.items ?? []).map((i, idx) => (
                        <div key={idx} className="text-xs">{i.quantity}× {i.name}</div>
                      ))}
                      {o.notes && <div className="text-xs text-neutral-400 italic mt-1">“{o.notes}”</div>}
                    </td>
                    <td className="py-3 pr-4 font-black text-neutral-800 whitespace-nowrap">{money(o.total)}</td>
                    <td className="py-3 pr-4">
                      <Pill label={o.status.replace("_", " ")} tone={STATUS_TONE[o.status] ?? "neutral"} />
                    </td>
                    <td className="py-3">
                      <select
                        value=""
                        disabled={busyId === o.id}
                        onChange={(e) => e.target.value && setStatus(o.id, e.target.value)}
                        className="px-2 py-1 rounded-lg border border-neutral-200 text-xs text-neutral-600 bg-white focus:outline-none focus:border-brand-red disabled:opacity-40"
                      >
                        <option value="">{busyId === o.id ? "Saving…" : "Set status…"}</option>
                        {STATUSES.filter((s) => s !== o.status).map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </div>
  );
}

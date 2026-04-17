"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  photo: string | null;
}

interface CartData {
  truckId: string;
  truckName: string;
  items: CartItem[];
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cart, setCart] = useState<CartData | null>(null);
  const [pickupName, setPickupName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    // Load cart
    try {
      const raw = localStorage.getItem("hot-truck-cart");
      if (raw) {
        const data: CartData = JSON.parse(raw);
        if (data.truckId === id) setCart(data);
        else window.location.href = `/truck/${id}`;
      } else {
        window.location.href = `/truck/${id}`;
      }
    } catch {
      window.location.href = `/truck/${id}`;
    }
    // Get logged-in user for order attribution
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        setCustomerId(data.user?.id ?? null);
      });
    });
  }, [id]);

  function updateQty(itemId: string, delta: number) {
    if (!cart) return;
    const updated = cart.items
      .map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + delta } : item
      )
      .filter((item) => item.quantity > 0);
    if (updated.length === 0) {
      localStorage.removeItem("hot-truck-cart");
      window.location.href = `/truck/${id}`;
      return;
    }
    const newCart = { ...cart, items: updated };
    setCart(newCart);
    localStorage.setItem("hot-truck-cart", JSON.stringify(newCart));
  }

  async function placeOrder() {
    if (!cart || !pickupName.trim()) {
      setError("Please enter your name for pickup.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truck_id: id,
          pickup_name: pickupName.trim(),
          notes: notes.trim() || null,
          items: cart.items.map((i) => ({
            menu_item_id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          total: subtotal,
          ...(customerId ? { customer_id: customerId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to place order");
      localStorage.removeItem("hot-truck-cart");
      window.location.href = `/truck/${id}/order/confirmation?orderId=${data.orderId}&name=${encodeURIComponent(pickupName.trim())}`;
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (!cart) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-[3px] border-brand-red border-t-transparent animate-spin" />
          <p className="text-neutral-400 text-sm">Loading your order...</p>
        </div>
      </div>
    );
  }

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-neutral-50 pb-10">

      {/* Header */}
      <div className="bg-neutral-900 px-5 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => window.history.back()}
          className="text-neutral-400 hover:text-white transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-white text-lg leading-tight">Review Order</h1>
          <p className="text-neutral-400 text-xs truncate">{cart.truckName}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-3 py-1.5">
          <span className="text-neutral-400 text-xs font-semibold">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">

        {/* Payment Notice Banner */}
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <path d="M2 10h20"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-black text-amber-800">Payment Due at the Truck</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              This is a pre-order only. No payment is taken online.
              Bring <span className="font-bold">cash or credit card</span> to pay when you pick up.
            </p>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-amber-200 rounded-md flex items-center justify-center">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <path d="M2 10h20"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-amber-800">Credit Card</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-amber-200 rounded-md flex items-center justify-center">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <span className="text-xs font-bold text-amber-800">Cash</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <p className="px-4 pt-4 pb-2 text-xs font-black text-neutral-400 uppercase tracking-wider">
            Your Items
          </p>
          <div className="divide-y divide-neutral-50">
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                {/* Photo */}
                <div className="w-12 h-12 rounded-lg bg-neutral-100 flex-shrink-0 overflow-hidden relative">
                  {item.photo ? (
                    <Image src={item.photo} alt={item.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                        <line x1="6" y1="1" x2="6" y2="4"/>
                        <line x1="10" y1="1" x2="10" y2="4"/>
                        <line x1="14" y1="1" x2="14" y2="4"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-neutral-900 truncate">{item.name}</p>
                  <p className="text-xs text-neutral-400">${item.price.toFixed(2)} each</p>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 active:scale-90 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="3" strokeLinecap="round">
                      <path d="M5 12h14"/>
                    </svg>
                  </button>
                  <span className="text-sm font-black text-neutral-900 w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center hover:bg-red-600 active:scale-90 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                </div>

                {/* Line total */}
                <p className="text-sm font-black text-brand-red flex-shrink-0 w-14 text-right">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Subtotal */}
          <div className="border-t border-neutral-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-500">Estimated Total</span>
            <span className="text-lg font-black text-neutral-900">${subtotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Pickup Info */}
        <div className="mt-4 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-3">Pickup Details</p>

          <div className="mb-3">
            <label className="block text-sm font-bold text-neutral-700 mb-1.5">
              Your Name <span className="text-brand-red">*</span>
            </label>
            <input
              type="text"
              value={pickupName}
              onChange={(e) => setPickupName(e.target.value)}
              placeholder="Name for your pickup order"
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-brand-red transition-colors bg-white"
            />
            <p className="text-xs text-neutral-400 mt-1.5">The truck will call this name when your order is ready.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-neutral-700 mb-1.5">
              Special Instructions{" "}
              <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, substitutions, extra sauce..."
              rows={3}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-red transition-colors resize-none bg-white"
            />
          </div>
        </div>

        {/* Place Order CTA */}
        <div className="mt-4 bg-white rounded-2xl shadow-sm p-4">

          {/* Order total row */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-neutral-500 font-semibold">Order Total</span>
            <span className="text-2xl font-black text-neutral-900">${subtotal.toFixed(2)}</span>
          </div>
          <p className="text-xs text-neutral-400 mb-4">Pay this amount at the truck — cash or card accepted.</p>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-3">
              <p className="text-sm text-red-600 font-semibold">{error}</p>
            </div>
          )}

          <button
            onClick={placeOrder}
            disabled={submitting || !pickupName.trim()}
            className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base tracking-wide disabled:opacity-50 active:scale-95 transition-all"
            style={{ boxShadow: "0 6px 20px rgba(232,72,28,0.30)" }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending Order...
              </span>
            ) : (
              "Send Order to Truck →"
            )}
          </button>

          <p className="text-xs text-neutral-400 text-center mt-3">
            By placing this order you agree to pick up and pay at the truck.
          </p>
        </div>

        {/* Add more items */}
        <div className="mt-3 text-center">
          <Link href={`/truck/${id}`} className="text-sm text-brand-red font-semibold hover:underline">
            ← Add more items
          </Link>
        </div>

      </div>
    </div>
  );
}

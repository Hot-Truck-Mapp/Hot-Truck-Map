"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Platform = {
  id: string;
  name: string;
  icon: string;
  color: string;
  connected: boolean;
  comingSoon: boolean;
  description: string;
};

const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "#E1306C",
    connected: false,
    comingSoon: true,
    description: "Post your location automatically when you go live",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "👥",
    color: "#1877F2",
    connected: false,
    comingSoon: true,
    description: "Share your location to your Facebook page",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "🐦",
    color: "#000000",
    connected: false,
    comingSoon: true,
    description: "Tweet your location to your followers",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    color: "#010101",
    connected: false,
    comingSoon: true,
    description: "Notify your TikTok followers when you're live",
  },
];

const PREVIEW_TEMPLATES = [
  "📍 We're live at {location}! Come find us 🚚🔥 #foodtruck #HotTruckMap",
  "🚚 {truck_name} is open NOW at {location}! {cuisine} done right. Come eat! 🙌",
  "📍 Lunch is served! Find us at {location} today until {close_time} 🍽️",
];

const MAX_BROADCAST = 160;
const RATE_LIMIT_SECS = 60;

export default function SocialPage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [platforms, setPlatforms] = useState(PLATFORMS);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Broadcast state
  const [truckId, setTruckId] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastCooldown, setBroadcastCooldown] = useState(0);
  const [broadcastToast, setBroadcastToast] = useState<{ msg: string; isError: boolean } | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    // Load truck id for broadcast
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mountedRef.current) return;
        const { data: truck } = await supabase
          .from("trucks")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!mountedRef.current) return;
        if (!truck) { router.replace("/"); return; }
        setTruckId(truck.id);
      } catch (err) {
        console.error("[social] Failed to load truck:", err);
        if (mountedRef.current) setBroadcastToast?.({ msg: "Could not load truck data. Please refresh.", isError: true });
      }
    })();
    return () => {
      mountedRef.current = false;
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (broadcastToastRef.current) clearTimeout(broadcastToastRef.current);
    };
  }, []);

  function showBroadcastToast(msg: string, isError: boolean) {
    if (broadcastToastRef.current) clearTimeout(broadcastToastRef.current);
    setBroadcastToast({ msg, isError });
    broadcastToastRef.current = setTimeout(() => {
      if (mountedRef.current) setBroadcastToast(null);
    }, 4000);
  }

  function startCooldown() {
    setBroadcastCooldown(RATE_LIMIT_SECS);
    cooldownRef.current = setInterval(() => {
      setBroadcastCooldown((n) => {
        if (n <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  async function sendBroadcast() {
    if (!broadcastMsg.trim() || !truckId || broadcastCooldown > 0) return;
    setBroadcastSending(true);
    try {
      const supabase = createClient();
      // Use getUser() (server round-trip) not getSession() (cached) so revoked
      // sessions are caught before the broadcast is sent.
      const { data: { user: broadcastUser } } = await supabase.auth.getUser();
      if (!broadcastUser) { router.replace("/login"); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/notify-followers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ truck_id: truckId, message: broadcastMsg.trim() }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      showBroadcastToast(
        `Broadcast sent to ${data.sent ?? 0} follower${data.sent !== 1 ? "s" : ""}!`,
        false
      );
      setBroadcastMsg("");
      startCooldown();
    } catch (err: any) {
      if (mountedRef.current) showBroadcastToast(err?.message ?? "Broadcast failed — try again.", true);
    } finally {
      if (mountedRef.current) setBroadcastSending(false);
    }
  }

  function toggleConnect(id: string) {
    const platform = platforms.find((p) => p.id === id);
    if (!platform || platform.comingSoon) return;
    // TODO: implement OAuth connections
  }

  const connectedCount = platforms.filter((p) => p.connected).length;
  const activeMessage = useCustom
    ? customMessage
    : PREVIEW_TEMPLATES[selectedTemplate];

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4">
        <h1 className="text-lg font-bold text-neutral-800">Social Sync</h1>
        <p className="text-sm text-neutral-400">
          Auto-post your location when you go live
        </p>
      </div>

      {/* Broadcast Toast */}
      {broadcastToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${
          broadcastToast.isError ? "bg-red-600 text-white" : "bg-green-600 text-white"
        }`}>
          {broadcastToast.msg}
        </div>
      )}

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto">

        {/* ── Broadcast to Followers ── */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-neutral-800">Broadcast to Followers</p>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            Send a push notification directly to everyone who follows your truck.
          </p>
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value.slice(0, MAX_BROADCAST))}
            placeholder="e.g. We're out of Al Pastor today — try the Birria instead! 🔥"
            rows={3}
            maxLength={MAX_BROADCAST}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium ${broadcastMsg.length >= MAX_BROADCAST - 10 ? "text-brand-red" : "text-neutral-400"}`}>
              {broadcastMsg.length}/{MAX_BROADCAST}
            </span>
            <button
              onClick={sendBroadcast}
              disabled={broadcastSending || broadcastCooldown > 0 || !broadcastMsg.trim() || !truckId}
              aria-label="Send broadcast message to followers"
              className="px-4 py-2 bg-brand-red text-white rounded-xl text-sm font-bold disabled:opacity-40 transition-opacity flex items-center gap-2"
            >
              {broadcastSending
                ? "Sending..."
                : broadcastCooldown > 0
                ? `Wait ${broadcastCooldown}s`
                : "Send Broadcast"}
            </button>
          </div>
          {broadcastCooldown > 0 && (
            <div className="mt-2">
              <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-red rounded-full transition-all duration-1000"
                  style={{ width: `${(broadcastCooldown / RATE_LIMIT_SECS) * 100}%` }}
                />
              </div>
              <p className="text-xs text-neutral-400 mt-1">You can send another broadcast in {broadcastCooldown}s</p>
            </div>
          )}
        </div>

        {/* Auto-post coming soon banner */}
        <div className="bg-brand-red/5 border border-brand-red/20 rounded-2xl p-4 flex gap-3">
          <span className="text-2xl flex-shrink-0">📡</span>
          <div>
            <p className="text-sm font-semibold text-neutral-800">
              Auto-posting coming soon
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Connect your accounts now to be ready. When live, your location will
              automatically post every time you tap Go Live.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-3">
            How it works
          </p>
          <div className="flex flex-col gap-3">
            {[
              { icon: "📍", text: "You tap Go Live on your dashboard" },
              { icon: "📡", text: "HotTruckMap gets your GPS location" },
              { icon: "📸", text: "Your location posts automatically to connected accounts" },
              { icon: "👥", text: "Your followers know exactly where to find you" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">{step.icon}</span>
                </div>
                <p className="text-sm text-neutral-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Cards */}
        <div>
          <p className="text-sm font-semibold text-neutral-700 mb-3">
            Connect Accounts
            {connectedCount > 0 && (
              <span className="ml-2 text-xs text-brand-red font-bold">
                {connectedCount} connected
              </span>
            )}
          </p>
          <div className="flex flex-col gap-3">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: `${platform.color}15` }}
                >
                  {platform.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-neutral-800 text-sm">
                      {platform.name}
                    </p>
                    {platform.comingSoon && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-neutral-100 text-neutral-400 rounded-full">
                        SOON
                      </span>
                    )}
                    {platform.connected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full">
                        CONNECTED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {platform.description}
                  </p>
                </div>
                <button
                  onClick={() => platform.comingSoon
                    ? setShowComingSoon(true)
                    : toggleConnect(platform.id)
                  }
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    platform.comingSoon
                      ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                      : platform.connected
                      ? "bg-red-50 text-brand-red border border-brand-red"
                      : "bg-brand-red text-white"
                  }`}
                >
                  {platform.comingSoon
                    ? "Soon"
                    : platform.connected
                    ? "Disconnect"
                    : "Connect"
                  }
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Post Template */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-neutral-800">
              Post Template
            </p>
            <button
              onClick={() => setUseCustom(!useCustom)}
              className="text-xs text-brand-red font-medium"
            >
              {useCustom ? "Use preset" : "Customize"}
            </button>
          </div>

          {!useCustom ? (
            <div className="flex flex-col gap-2">
              {PREVIEW_TEMPLATES.map((template, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTemplate(i)}
                  className={`text-left p-3 rounded-xl border text-xs text-neutral-600 transition-all ${
                    selectedTemplate === i
                      ? "border-brand-red bg-red-50"
                      : "border-neutral-100 bg-neutral-50"
                  }`}
                >
                  {template}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value.slice(0, 500))}
              placeholder="Write your custom post... Use {location}, {truck_name}, {close_time} as variables"
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red resize-none"
            />
          )}

          {/* Preview */}
          <div className="mt-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1">
              Preview
            </p>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {activeMessage
                .replaceAll("{location}", "Main St & 5th Ave, Newark NJ")
                .replaceAll("{truck_name}", "Your Truck Name")
                .replaceAll("{close_time}", "3:00 PM")
                .replaceAll("{cuisine}", "Tacos")}
            </p>
          </div>
        </div>

        {/* Go Live Preview */}
        <div className="bg-brand-red rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-200" />
            </span>
            <p className="text-sm font-bold">When you Go Live</p>
          </div>
          <p className="text-xs opacity-80 leading-relaxed">
            {connectedCount === 0
              ? "Connect at least one account above to enable auto-posting when you go live."
              : `Your location will automatically post to ${connectedCount} connected account${connectedCount > 1 ? "s" : ""} the moment you tap Go Live.`
            }
          </p>
        </div>

      </div>

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center">
            <p className="text-4xl mb-3">🚧</p>
            <h2 className="text-lg font-bold text-neutral-800 mb-2">
              Coming in Phase 5
            </h2>
            <p className="text-sm text-neutral-500 mb-6">
              We're working on integrations for Facebook, X, and TikTok.
              Instagram is up first — stay tuned!
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="w-full py-3 bg-brand-red text-white rounded-2xl font-bold text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
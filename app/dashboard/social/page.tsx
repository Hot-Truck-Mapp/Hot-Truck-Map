"use client";

import { useState } from "react";

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
    comingSoon: false,
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

export default function SocialPage() {
  const [platforms, setPlatforms] = useState(PLATFORMS);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  function toggleConnect(id: string) {
    setPlatforms(platforms.map((p) =>
      p.id === id && !p.comingSoon
        ? { ...p, connected: !p.connected }
        : p
    ));
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

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto">

        {/* Phase 5 Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <span className="text-2xl flex-shrink-0">🚧</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Full integration coming in Phase 5
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Connect your accounts below to be ready when it launches.
              Your location will auto-post every time you tap Go Live.
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
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Write your custom post... Use {location}, {truck_name}, {close_time} as variables"
              rows={4}
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
                .replace("{location}", "Main St & 5th Ave, Newark NJ")
                .replace("{truck_name}", "Your Truck Name")
                .replace("{close_time}", "3:00 PM")
                .replace("{cuisine}", "Tacos")}
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
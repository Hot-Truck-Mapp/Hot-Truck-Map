import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "ikrhlifpznzdtgxleubz.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",         value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js + Turbopack require 'unsafe-inline' and 'unsafe-eval' for hot-reload/RSC;
              // tighten to nonce-based CSP once inline scripts are eliminated.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              `connect-src 'self' https://${supabaseHostname} wss://${supabaseHostname} https://api.mapbox.com https://events.mapbox.com https://exp.host`,
              `img-src 'self' data: blob: https://${supabaseHostname} https://api.mapbox.com`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

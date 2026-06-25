"use client";

import { usePathname } from "next/navigation";

// Pages where the footer would overlap full-screen content
const NO_FOOTER_PATHS = ["/"];

export default function ConditionalFooter() {
  const pathname = usePathname();
  if (NO_FOOTER_PATHS.includes(pathname)) return null;

  return (
    <footer className="bg-neutral-900 border-t border-neutral-800 px-6 py-4 text-center text-xs text-neutral-500 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <span>© {new Date().getFullYear()} Hot Truck Map</span>
      <a href="/about" className="hover:text-neutral-300 transition-colors">About</a>
      <a href="/trucks" className="hover:text-neutral-300 transition-colors">Trucks</a>
      <a href="/trucks/leaderboard" className="hover:text-neutral-300 transition-colors">Leaderboard</a>
      <a href="/reviews" className="hover:text-neutral-300 transition-colors">Reviews</a>
      <a href="/catering" className="hover:text-neutral-300 transition-colors">Catering</a>
      <a href="/contact" className="hover:text-neutral-300 transition-colors">Contact</a>
      <a href="/terms" className="hover:text-neutral-300 transition-colors">Terms</a>
      <a href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</a>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pages where the footer would overlap full-screen content
const NO_FOOTER_PATHS = ["/"];

export default function ConditionalFooter() {
  const pathname = usePathname();
  if (NO_FOOTER_PATHS.includes(pathname)) return null;

  return (
    <footer className="bg-neutral-900 border-t border-neutral-800 px-6 py-4 text-center text-xs text-neutral-500 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <span>© {new Date().getFullYear()} Hot Truck Map</span>
      <Link href="/about" className="hover:text-neutral-300 transition-colors">About</Link>
      <Link href="/trucks" className="hover:text-neutral-300 transition-colors">Trucks</Link>
      <Link href="/trucks/leaderboard" className="hover:text-neutral-300 transition-colors">Leaderboard</Link>
      <Link href="/events" className="hover:text-neutral-300 transition-colors">Events</Link>
      <Link href="/newsletter" className="hover:text-neutral-300 transition-colors">Newsletter</Link>
      <Link href="/reviews" className="hover:text-neutral-300 transition-colors">Reviews</Link>
      <Link href="/catering" className="hover:text-neutral-300 transition-colors">Catering</Link>
      <Link href="/contact" className="hover:text-neutral-300 transition-colors">Contact</Link>
      <Link href="/terms" className="hover:text-neutral-300 transition-colors">Terms</Link>
      <Link href="/privacy" className="hover:text-neutral-300 transition-colors">Privacy</Link>
    </footer>
  );
}

import Link from "next/link";

export default function NewsletterNav() {
  return (
    <nav className="bg-neutral-900 border-b border-neutral-800 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M1 3h15v13H1z"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1">
            <span className="font-black text-brand-red text-sm">HOT</span>
            <span className="font-black text-white text-sm">TRUCK</span>
          </div>
          <span className="font-black text-brand-orange text-sm leading-none">MAP</span>
        </div>
      </Link>
      <Link href="/" className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-semibold hover:border-neutral-500 hover:text-white transition-colors">
        Back to Map
      </Link>
    </nav>
  );
}

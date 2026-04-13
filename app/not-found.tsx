import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 mb-6">
          <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
          <span className="font-black text-neutral-800 text-2xl tracking-tight">TRUCK</span>
          <span className="font-black text-brand-orange text-2xl tracking-tight">MAPS</span>
        </div>

        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 3h15v13H1z"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>

        <h1 className="text-4xl font-black text-neutral-800 mb-2">404</h1>
        <p className="text-neutral-500 font-medium mb-1">Page not found</p>
        <p className="text-neutral-400 text-sm">
          Looks like this truck drove away.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="w-full py-3.5 bg-brand-red text-white rounded-2xl font-bold text-sm text-center"
        >
          Back to Map
        </Link>
        <Link
          href="/trucks"
          className="w-full py-3.5 border-2 border-neutral-200 text-neutral-600 rounded-2xl font-bold text-sm text-center"
        >
          Browse All Trucks
        </Link>
      </div>
    </div>
  );
}

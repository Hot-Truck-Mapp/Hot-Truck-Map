export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-neutral-400 font-medium">Loading…</p>
      </div>
    </div>
  );
}

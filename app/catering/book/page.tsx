import Link from "next/link";

export default function CateringBookPage() {
  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-xl font-black text-neutral-900 uppercase tracking-wide mb-2">
          Book a Food Truck
        </h1>
        <p className="text-neutral-400 text-sm mb-4">
          Select a truck from the catering page to book
        </p>
        <Link
          href="/catering"
          className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold"
        >
          Browse Catering Trucks
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support | Hot Truck Map",
  description: "Get help with Hot Truck Map. Contact support, find FAQs, and get answers.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-red rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <span className="font-black text-brand-red text-lg">HOT TRUCK</span>
            <span className="font-black text-neutral-800 text-lg"> MAP</span>
          </div>
        </div>

        <h1 className="text-3xl font-black text-neutral-900 mb-2">Support</h1>
        <p className="text-neutral-500 mb-8">We&apos;re here to help. Reach out and we&apos;ll get back to you within 24 hours.</p>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h2 className="font-bold text-neutral-800 mb-1">Email Support</h2>
          <p className="text-sm text-neutral-500 mb-3">For account issues, bug reports, or general questions.</p>
          <a href="mailto:hottruckmap@gmail.com" className="text-brand-red font-semibold text-sm hover:underline">
            hottruckmap@gmail.com
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <h2 className="font-bold text-neutral-800 mb-1">Food Truck Operators</h2>
          <p className="text-sm text-neutral-500 mb-3">Questions about listing your truck, going live, or managing orders.</p>
          <a href="mailto:hottruckmap@gmail.com?subject=Operator Support" className="text-brand-red font-semibold text-sm hover:underline">
            hottruckmap@gmail.com
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-neutral-800 mb-1">FAQs</h2>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li>• The app is currently free to use while we grow the community.</li>
            <li>• Customers pay at the truck — no online payments.</li>
            <li>• Trucks must sign up and tap &quot;Go Live&quot; to appear on the map.</li>
            <li>• To delete your account, go to Account → Delete Account in the app.</li>
          </ul>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          {" · "}
          <Link href="/" className="hover:underline">Home</Link>
        </p>
      </div>
    </div>
  );
}

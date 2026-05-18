import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Hot Truck Map",
  description: "Terms of Service for Hot Truck Map — the food truck discovery and ordering platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-3">
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
              <span className="font-black text-brand-red text-sm tracking-tight">HOT</span>
              <span className="font-black text-white text-sm tracking-tight">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-sm tracking-tight leading-none">MAP</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/trucks" className="text-neutral-400 hover:text-white text-sm font-semibold transition-colors">
            Find Trucks
          </Link>
          <Link href="/account" aria-label="Account" className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-black text-neutral-900 mb-2">Terms of Service</h1>
        <p className="text-neutral-400 text-sm mb-8">Last updated: May 11, 2026</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">1. Service Description</h2>
            <p>
              Hot Truck Map (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates a food truck discovery and pre-ordering
              platform at hottruckmap.com and its associated mobile applications. Our platform enables
              customers to locate food trucks in real time, browse menus, place pre-orders for pickup,
              and follow their favorite trucks.
            </p>
            <p className="mt-3">
              Hot Truck Map is a technology platform only. We do not prepare, sell, or deliver food.
              All food products are prepared and sold by independent food truck operators (&quot;Operators&quot;)
              who use our platform to reach customers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">2. User Accounts</h2>
            <p>
              To access certain features — including placing orders, following trucks, or submitting
              reviews — you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide accurate, current, and complete information during registration.</li>
              <li>Maintain and update your account information as needed.</li>
              <li>Keep your password confidential and notify us promptly of any unauthorized use.</li>
              <li>Be at least 13 years of age (or the minimum age of digital consent in your jurisdiction).</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these Terms, are
              suspected of fraudulent activity, or have been inactive for an extended period.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">3. Operator Responsibilities</h2>
            <p>
              Food truck operators who register on Hot Truck Map agree to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Hold all required licenses, permits, and health certifications applicable to their jurisdiction.</li>
              <li>Maintain accurate menu information, including prices and item availability.</li>
              <li>Fulfill pre-orders placed through the platform in a timely and professional manner.</li>
              <li>Accurately represent their location when broadcasting their live status.</li>
              <li>Not use the platform to misrepresent their business or deceive customers.</li>
            </ul>
            <p className="mt-3">
              Operators are solely responsible for the quality, safety, and accuracy of the food and
              information they provide. Hot Truck Map is not liable for any issues arising from an
              Operator&apos;s food products or conduct.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">4. Ordering and Payment</h2>
            <p>
              Hot Truck Map facilitates pre-orders only. <strong>No payment is collected through
              our platform.</strong> All payments are made directly to the Operator at the time of
              pickup — cash or card at the operator&apos;s discretion.
            </p>
            <p className="mt-3">
              By placing an order you agree to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Arrive at the truck within a reasonable time to pick up your order.</li>
              <li>Pay the full order amount to the Operator at pickup.</li>
              <li>Acknowledge that orders may be cancelled by the Operator if you do not arrive.</li>
            </ul>
            <p className="mt-3">
              Hot Truck Map is not responsible for disputes between customers and Operators regarding
              orders, pricing, food quality, or availability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">5. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the platform for any unlawful purpose or in violation of any regulations.</li>
              <li>Submit false, misleading, or defamatory reviews or spotted posts.</li>
              <li>Attempt to gain unauthorized access to our systems or another user&apos;s account.</li>
              <li>Scrape, harvest, or otherwise collect data from the platform without our written consent.</li>
              <li>Upload content that is offensive, harassing, or violates the rights of others.</li>
              <li>Use the platform to spam, phish, or conduct any form of fraud.</li>
              <li>Impersonate any person, business, or entity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">6. User-Generated Content</h2>
            <p>
              By submitting reviews, photos, spotted posts, or other content to Hot Truck Map, you
              grant us a non-exclusive, royalty-free, worldwide license to use, display, and distribute
              that content on our platform and in promotional materials.
            </p>
            <p className="mt-3">
              You represent that you own or have the necessary rights to any content you submit and
              that such content does not violate the rights of any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">7. Disclaimers</h2>
            <p>
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p className="mt-3">
              We do not warrant that the platform will be uninterrupted, error-free, or free of
              harmful components. Truck location data is provided by Operators in real time and may
              not always be accurate or current.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HOT TRUCK MAP SHALL NOT BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT
              OF OR RELATED TO YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO LOSS OF DATA,
              LOST PROFITS, OR PERSONAL INJURY.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">9. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of
              New Jersey, without regard to its conflict of law provisions. Any disputes arising
              under these Terms shall be subject to the exclusive jurisdiction of the courts located
              in New Jersey.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">10. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we do, we will update the &quot;Last
              updated&quot; date above. Continued use of the platform after changes constitutes your
              acceptance of the revised Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">11. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:hottruckmap@gmail.com" className="text-brand-red hover:underline font-semibold">
                hottruckmap@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

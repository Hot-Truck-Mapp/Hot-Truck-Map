import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Hot Truck Map",
  description: "Privacy Policy for Hot Truck Map — how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-black text-neutral-900 mb-2">Privacy Policy</h1>
        <p className="text-neutral-400 text-sm mb-8">Last updated: May 11, 2026</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">1. Overview</h2>
            <p>
              Hot Truck Map (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your privacy. This
              Privacy Policy explains what information we collect, how we use it, and your rights
              regarding that information when you use hottruckmap.com or our mobile applications.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">2. Information We Collect</h2>

            <h3 className="font-black text-neutral-800 mb-2">Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li><strong>Email address</strong> — collected at account registration and used for authentication and service communications.</li>
              <li><strong>Name</strong> — used for pickup order identification and display purposes.</li>
              <li><strong>Profile photo</strong> — optional; uploaded by you to personalize your account.</li>
              <li><strong>Truck information (Operators only)</strong> — including truck name, description, cuisine type, phone number, Instagram handle, and menu items.</li>
            </ul>

            <h3 className="font-black text-neutral-800 mb-2">Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li><strong>Location data</strong> — when Operators broadcast their truck&apos;s live location, we collect and store GPS coordinates and a derived address. Customers may optionally share their location to find nearby trucks; this data is not stored on our servers.</li>
              <li><strong>Order history</strong> — details of pre-orders you place, including items, quantities, and pickup name.</li>
              <li><strong>Usage data</strong> — page views, truck profile views, and feature interactions, used in aggregate to improve the platform.</li>
              <li><strong>Device information</strong> — browser type, operating system, and IP address, collected for security and analytics purposes.</li>
            </ul>

            <h3 className="font-black text-neutral-800 mb-2">User-Generated Content</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Reviews and ratings you submit for food trucks.</li>
              <li>Photos you upload of food trucks or menu items.</li>
              <li>Spotted posts indicating a truck&apos;s location.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, operate, and improve the Hot Truck Map platform.</li>
              <li>Authenticate users and maintain account security.</li>
              <li>Display truck locations, menus, and profiles to customers.</li>
              <li>Process and communicate pre-orders between customers and Operators.</li>
              <li>Send service-related communications, including email confirmation and order notifications.</li>
              <li>Send push notifications to users who have opted in (e.g., when a followed truck goes live).</li>
              <li>Analyze usage patterns to improve features and user experience.</li>
              <li>Detect and prevent fraudulent or abusive activity.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties. We do not use your data
              for targeted advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">4. Third-Party Services</h2>
            <p>
              We use the following third-party services to operate the platform. Each has their own
              privacy policies governing how they handle data:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong>Supabase</strong> — database, authentication, and file storage provider.
                Your account data, orders, and uploaded files are stored on Supabase infrastructure.
                See{" "}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                  supabase.com/privacy
                </a>
                .
              </li>
              <li>
                <strong>Mapbox</strong> — maps and location services. Your device&apos;s approximate
                location may be transmitted to Mapbox when viewing the map. See{" "}
                <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                  mapbox.com/legal/privacy
                </a>
                .
              </li>
              <li>
                <strong>Twilio</strong> — used for SMS notifications (where applicable). Phone
                numbers shared for SMS are processed by Twilio. See{" "}
                <a href="https://www.twilio.com/en-us/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                  twilio.com/legal/privacy
                </a>
                .
              </li>
              <li>
                <strong>Stripe</strong> — payment processing infrastructure (used for Operator
                subscriptions where applicable). See{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <strong>Expo / Expo Push Notifications</strong> — our mobile apps are built with
                Expo. Push notification tokens are processed by Expo&apos;s push notification service.
                See{" "}
                <a href="https://expo.dev/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
                  expo.dev/privacy
                </a>
                .
              </li>
              <li>
                <strong>Vercel Analytics</strong> — anonymous page view analytics. No personal
                data is associated with analytics events.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Order history is
              retained for a minimum of 12 months for Operator record-keeping purposes. You may
              request deletion of your account at any time (see Your Rights below).
            </p>
            <p className="mt-3">
              Anonymized and aggregated analytics data may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">6. Cookies and Local Storage</h2>
            <p>
              We use browser local storage and session storage to maintain your shopping cart and
              session preferences. Authentication tokens are stored in secure, HTTP-only cookies
              managed by Supabase. We do not use third-party tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
              <li><strong>Correction</strong> — update or correct inaccurate information in your account settings.</li>
              <li><strong>Deletion</strong> — request deletion of your account and associated personal data. Some data may be retained as required by law or for legitimate business purposes.</li>
              <li><strong>Portability</strong> — request your data in a machine-readable format.</li>
              <li><strong>Opt-out</strong> — unsubscribe from marketing communications at any time. You may also turn off push notifications in your account settings or device settings.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:hottruckmap@gmail.com" className="text-brand-red hover:underline font-semibold">
                hottruckmap@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">8. Children&apos;s Privacy</h2>
            <p>
              Hot Truck Map is not directed to children under the age of 13. We do not knowingly
              collect personal information from children under 13. If you believe we have
              inadvertently collected such information, please contact us and we will promptly
              delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. When we make material changes, we will
              update the &quot;Last updated&quot; date above and, where appropriate, notify you by email
              or in-app notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-neutral-900 mb-3">10. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy, please
              contact us at:
            </p>
            <div className="mt-3 p-4 bg-neutral-100 rounded-xl">
              <p className="font-black text-neutral-900">Hot Truck Map</p>
              <p>
                <a href="mailto:hottruckmap@gmail.com" className="text-brand-red hover:underline font-semibold">
                  hottruckmap@gmail.com
                </a>
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

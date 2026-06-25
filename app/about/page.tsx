import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Hot Truck Map | Our Mission",
  description:
    "Hot Truck Map is on a mission to connect customers and food truck operators across all 50 states — building the largest real-time food truck community in America.",
  openGraph: {
    title: "About Hot Truck Map",
    description:
      "Our mission is to connect the world with the food trucks they love — one block, one city, one state at a time.",
    type: "website",
  },
};

const VALUES = [
  {
    title: "Community First",
    body: "Food trucks are small businesses run by real people. Every feature we build starts with one question: does this help operators succeed?",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    title: "Real-Time, Always",
    body: "Trucks move. Schedules change. Our live GPS map means you find the food truck — not yesterday's parking spot.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    title: "Built To Grow",
    body: "Your followers, your reviews, your menu — your brand. From one truck to a national fleet, our tools scale with you.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 6l-9.5 9.5-5-5L1 18"/>
        <path d="M17 6h6v6"/>
      </svg>
    ),
  },
  {
    title: "Built For The Road",
    body: "Designed by people who know food trucks. Every feature — from Go Live to catering bookings — solves a real problem operators face every day.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 3h15v13H1z"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Hero */}
      <section className="relative bg-neutral-900 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #E8481C 0%, transparent 40%), radial-gradient(circle at 80% 70%, #F5A623 0%, transparent 40%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 py-20 sm:py-24 text-center">
          <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-900/50">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <p className="text-xs font-black text-brand-orange uppercase tracking-[0.25em] mb-4">Our Mission</p>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.05] tracking-tight mb-5">
            Connecting the world<br />
            <span className="text-brand-red">one food truck</span> at a time.
          </h1>
          <p className="text-neutral-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            Hot Truck Map is building the largest real-time food truck community in America —
            one block, one city, one state at a time, until every operator and every hungry
            customer can find each other across all 50 states.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link
              href="/"
              className="px-6 py-3 bg-brand-red text-white rounded-full font-black text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-900/30"
            >
              Explore The Map
            </Link>
            <Link
              href="/signup?role=operator"
              className="px-6 py-3 border border-neutral-600 text-neutral-200 rounded-full font-bold text-sm hover:border-neutral-400 hover:text-white transition-colors"
            >
              List My Truck
            </Link>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        <p className="text-xs font-black text-brand-red uppercase tracking-[0.25em] mb-3">Our Story</p>
        <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 leading-tight mb-6">
          Built because finding a food truck shouldn&rsquo;t feel like a scavenger hunt.
        </h2>
        <div className="space-y-5 text-neutral-700 text-base leading-relaxed">
          <p>
            Anyone who&rsquo;s ever chased a food truck knows the feeling — you saw a post on
            Instagram last Tuesday, drove twenty minutes to the spot, and the truck is nowhere
            to be found. Meanwhile, three blocks away, an incredible operator is parked with
            no line because their regulars don&rsquo;t know they&rsquo;re there.
          </p>
          <p>
            That gap — between brilliant food and the people who want to eat it — is what we
            set out to close. Hot Truck Map gives operators a free, professional home on the
            web and a one-tap way to broadcast their live location. It gives customers a real
            map of what&rsquo;s open <em>right now</em>, not what was open last week.
          </p>
          <p>
            We&rsquo;re not a delivery app. We&rsquo;re not a marketplace skimming commissions.
            We&rsquo;re a community — built for the operators, the regulars, and everyone who
            believes the best food in America is being served out of a window on wheels.
          </p>
        </div>
      </section>

      {/* The 50-state vision */}
      <section className="bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-20">
          <div className="grid sm:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-black text-brand-orange uppercase tracking-[0.25em] mb-3">The Vision</p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-5">
                One nation. <span className="text-brand-orange">Fifty states.</span> Every food truck on the map.
              </h2>
              <p className="text-neutral-300 leading-relaxed mb-4">
                From the taco trucks of East LA to the lobster rolls of coastal Maine — from
                Nashville hot chicken to Detroit Coney dogs — America&rsquo;s food truck scene
                is one of the most diverse and creative culinary movements on earth.
              </p>
              <p className="text-neutral-300 leading-relaxed">
                Our goal is simple: a single, real-time map where every food truck in every
                state has a home, and every hungry customer can find them. We&rsquo;re building
                that map together — one operator, one city, one state at a time.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="States" value="50" sub="Our goal — coast to coast" />
              <Stat label="Setup" value="Minutes" sub="From signup to live on the map" />
              <Stat label="Updates" value="Live" sub="Real-time GPS, always" />
              <Stat label="Reach" value="National" sub="One map, every city" />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-4xl mx-auto px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-black text-brand-red uppercase tracking-[0.25em] mb-3">What We Believe</p>
          <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 leading-tight">
            The principles behind every line of code.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-100"
            >
              <div className="w-11 h-11 bg-brand-red/10 text-brand-red rounded-xl flex items-center justify-center mb-4">
                {v.icon}
              </div>
              <h3 className="font-black text-neutral-900 text-lg mb-2">{v.title}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two-up CTA */}
      <section className="bg-white border-t border-neutral-100">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-20">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-neutral-900 rounded-2xl p-8 text-white">
              <p className="text-xs font-black text-brand-orange uppercase tracking-widest mb-2">For Customers</p>
              <h3 className="text-2xl font-black mb-3 leading-tight">Find the food truck. Skip the guesswork.</h3>
              <p className="text-neutral-300 text-sm leading-relaxed mb-6">
                See every open truck near you in real time. Browse menus, read reviews,
                and pre-order so you can walk up and skip the line.
              </p>
              <Link
                href="/"
                className="inline-block px-5 py-2.5 bg-brand-red text-white rounded-full font-black text-sm hover:bg-red-600 transition-colors"
              >
                Open The Map →
              </Link>
            </div>
            <div className="bg-brand-red rounded-2xl p-8 text-white">
              <p className="text-xs font-black text-red-200 uppercase tracking-widest mb-2">For Operators</p>
              <h3 className="text-2xl font-black mb-3 leading-tight">Join the largest food truck community in America.</h3>
              <p className="text-red-100 text-sm leading-relaxed mb-6">
                List your truck, broadcast your live location, take catering bookings, and
                grow your following. Get on the map in minutes.
              </p>
              <Link
                href="/signup?role=operator"
                className="inline-block px-5 py-2.5 bg-white text-brand-red rounded-full font-black text-sm hover:bg-red-50 transition-colors"
              >
                List My Truck →
              </Link>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-neutral-500">
              Questions, partnerships, or press inquiries?{" "}
              <Link href="/contact" className="text-brand-red font-bold hover:underline">
                Get in touch →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-neutral-800/60 backdrop-blur-sm border border-neutral-700 rounded-2xl p-5">
      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-white leading-none mb-2">{value}</p>
      <p className="text-[11px] text-neutral-400 leading-snug">{sub}</p>
    </div>
  );
}

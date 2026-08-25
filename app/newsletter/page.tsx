import Link from "next/link";
import NewsletterNav from "@/components/newsletter/NewsletterNav";
import SubscribeForm from "@/components/newsletter/SubscribeForm";
import { ISSUES, NEWSLETTER_NAME, NEWSLETTER_TAGLINE, nextIssueLabel, readMinutes } from "@/lib/newsletter";

export default function NewsletterIndexPage() {
  const [latest, ...older] = ISSUES;

  return (
    <div className="min-h-screen bg-neutral-100">
      <NewsletterNav />

      {/* Masthead */}
      <div className="bg-neutral-900 px-4 pt-12 pb-10 text-center border-b-2 border-brand-red">
        <span className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-4">
          A Hot Truck Map Publication · Every Two Weeks
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          {NEWSLETTER_NAME}
        </h1>
        <p className="text-neutral-400 text-sm mt-2 max-w-md mx-auto">
          {NEWSLETTER_TAGLINE}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
        {/* Featured: latest issue */}
        {latest && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">
              Latest Issue
            </p>
            <Link
              href={`/newsletter/${latest.slug}`}
              className="block bg-white rounded-2xl shadow-sm p-6 sm:p-8 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 mb-3">
                <span>Issue #{latest.issue}</span>
                <span aria-hidden>·</span>
                <time dateTime={latest.dateISO}>{latest.dateLabel}</time>
                <span aria-hidden>·</span>
                <span>{readMinutes(latest)} min read</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 leading-snug mb-3">
                {latest.headline.emoji} {latest.title}
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed mb-4">
                {latest.summary}
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {latest.tldr.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-semibold text-neutral-600 bg-neutral-100 rounded-full px-3 py-1.5"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-black text-brand-red">
                Read the full issue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </Link>
          </div>
        )}

        {/* Archive */}
        {older.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">
              Past Issues
            </p>
            <div className="space-y-3">
              {older.map((u) => (
                <Link
                  key={u.slug}
                  href={`/newsletter/${u.slug}`}
                  className="flex items-center justify-between gap-4 bg-white rounded-xl shadow-sm px-5 py-4 hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-400 mb-0.5">
                      <span>Issue #{u.issue}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={u.dateISO}>{u.dateLabel}</time>
                    </div>
                    <p className="font-bold text-neutral-900 text-sm">
                      {u.headline.emoji} {u.title}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-neutral-300 flex-shrink-0"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Next issue + email signup */}
        <div>
          <p className="text-center text-xs font-semibold text-neutral-400 mb-3">
            Next issue lands {nextIssueLabel()}
          </p>
          <SubscribeForm />
        </div>
      </div>
    </div>
  );
}

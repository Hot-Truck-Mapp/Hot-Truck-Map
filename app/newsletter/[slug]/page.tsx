import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NewsletterNav from "@/components/newsletter/NewsletterNav";
import SubscribeForm from "@/components/newsletter/SubscribeForm";
import {
  ISSUES,
  getIssueBySlug,
  getAdjacentIssues,
  readMinutes,
  nextIssueLabel,
  NEWSLETTER_NAME,
  type NewsletterItem,
} from "@/lib/newsletter";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return ISSUES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const issue = getIssueBySlug(slug);
  if (!issue) return { title: "Newsletter | HotTruckMap" };

  return {
    title: `${issue.title} | ${NEWSLETTER_NAME} · Hot Truck Map`,
    description: issue.summary,
    openGraph: {
      title: `${issue.title} | ${NEWSLETTER_NAME}`,
      description: issue.summary,
    },
  };
}

const TAG_STYLES: Record<NewsletterItem["tag"], string> = {
  NEW: "bg-brand-red/10 text-brand-red",
  IMPROVED: "bg-brand-orange/10 text-orange-700",
  FIX: "bg-neutral-200 text-neutral-600",
};

const TAG_BORDER: Record<NewsletterItem["tag"], string> = {
  NEW: "border-brand-red",
  IMPROVED: "border-brand-orange",
  FIX: "border-neutral-300",
};

export default async function NewsletterIssuePage({ params }: Props) {
  const { slug } = await params;
  const issue = getIssueBySlug(slug);
  if (!issue) notFound();

  const { older, newer } = getAdjacentIssues(slug);

  return (
    <div className="min-h-screen bg-neutral-100">
      <NewsletterNav />

      {/* Masthead */}
      <div className="bg-neutral-900 px-4 pt-10 pb-9 text-center border-b-2 border-brand-red">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange mb-4">
          {NEWSLETTER_NAME} · A Hot Truck Map Publication
        </p>
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-400 mb-3">
          <span>Issue #{issue.issue}</span>
          <span aria-hidden>·</span>
          <time dateTime={issue.dateISO}>{issue.dateLabel}</time>
          <span aria-hidden>·</span>
          <span>{readMinutes(issue)} min read</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight max-w-xl mx-auto leading-snug">
          {issue.headline.emoji} {issue.title}
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* TL;DR */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">
            In This Issue
          </p>
          <ul className="space-y-2">
            {issue.tldr.map((t) => (
              <li key={t} className="text-sm font-semibold text-neutral-800 flex gap-2">
                <span className="text-brand-red">—</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Headline story */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-7">
          <span className="inline-block text-xs font-black uppercase tracking-wide text-brand-red bg-brand-red/10 rounded-full px-2.5 py-1 mb-3">
            {issue.headline.tag}
          </span>
          <h2 className="text-xl font-black text-neutral-900 mb-3">{issue.headline.title}</h2>
          <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
            {issue.headline.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {issue.headline.cta && (
            <Link
              href={issue.headline.cta.href}
              className="inline-block mt-4 px-5 py-2.5 bg-brand-red text-white rounded-full font-black text-sm hover:bg-red-600 transition-colors"
            >
              {issue.headline.cta.label}
            </Link>
          )}
        </div>

        {/* Other items */}
        {issue.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-7">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">
              Also in This Issue
            </h3>
            <div className="space-y-4">
              {issue.items.map((item) => (
                <div key={item.title} className={`border-l-2 pl-4 ${TAG_BORDER[item.tag]}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base leading-none">{item.emoji}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-0.5 ${TAG_STYLES[item.tag]}`}>
                      {item.tag}
                    </span>
                    <h4 className="font-bold text-neutral-900 text-sm">{item.title}</h4>
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign-off */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-7">
          <p className="text-sm text-neutral-700 leading-relaxed">
            That&rsquo;s it for this issue — thanks for reading. Spot a bug, or want to see
            something built? <Link href="/contact" className="text-brand-red font-bold hover:underline">Tell us</Link>.
          </p>
          <p className="text-xs font-bold text-neutral-400 mt-3">— The Hot Truck Map Team</p>
        </div>

        {/* Prev / next issue nav */}
        {(older || newer) && (
          <div className="flex items-center justify-between pt-1 text-sm font-bold">
            {older ? (
              <Link href={`/newsletter/${older.slug}`} className="text-neutral-500 hover:text-neutral-800 transition-colors">
                ← Issue #{older.issue}
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link href={`/newsletter/${newer.slug}`} className="text-neutral-500 hover:text-neutral-800 transition-colors">
                Issue #{newer.issue} →
              </Link>
            ) : (
              <span />
            )}
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

      <div className="px-4 py-8 text-center">
        <Link href="/newsletter" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
          ← All issues of {NEWSLETTER_NAME}
        </Link>
      </div>
    </div>
  );
}

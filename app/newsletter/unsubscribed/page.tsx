import Link from "next/link";
import NewsletterNav from "@/components/newsletter/NewsletterNav";
import { NEWSLETTER_NAME } from "@/lib/newsletter";

export default async function NewsletterUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { ok } = await searchParams;
  const success = ok !== "0";

  return (
    <div className="min-h-screen bg-neutral-100">
      <NewsletterNav />
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <p className="text-3xl mb-3">{success ? "👋" : "⚠️"}</p>
          <h1 className="text-xl font-black text-neutral-900 mb-2">
            {success ? "You're unsubscribed" : "That link didn't work"}
          </h1>
          <p className="text-sm text-neutral-500 leading-relaxed">
            {success
              ? `You won't receive any more emails from ${NEWSLETTER_NAME}. You can always bookmark and read future issues on the site without subscribing.`
              : "That unsubscribe link is invalid or has expired. If you're still receiving emails you don't want, contact us and we'll remove you manually."}
          </p>
          <Link
            href={success ? "/newsletter" : "/contact"}
            className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-brand-red text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {success ? "Back to Newsletter" : "Contact Us"}
          </Link>
        </div>
      </div>
    </div>
  );
}

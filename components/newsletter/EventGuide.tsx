import Link from "next/link";
import type { NewsletterEventGuide } from "@/lib/newsletter";

function countyLabel(county: string): string {
  return /County$/i.test(county) ? county : `${county} County`;
}

export default function EventGuide({ guide }: { guide: NewsletterEventGuide }) {
  return (
    <section aria-labelledby="event-guide-heading" className="space-y-5">
      {/* Guide header + state jump links */}
      <div className="bg-neutral-900 rounded-2xl p-5 sm:p-7 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange mb-2">
          {guide.dateRange}
        </p>
        <h2 id="event-guide-heading" className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {guide.heading}
        </h2>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {guide.states.map((st) => {
            const total = st.groups.reduce((n, g) => n + g.events.length, 0);
            return (
              <a
                key={st.stateCode}
                href={`#state-${st.stateCode.toLowerCase()}`}
                className="text-xs font-bold text-white bg-white/10 border border-white/10 rounded-full px-3.5 py-1.5 hover:bg-white/20 transition-colors"
              >
                {st.stateName} · {total} events
              </a>
            );
          })}
        </div>
      </div>

      {guide.states.map((st) => {
        const slug = st.stateCode.toLowerCase();
        return (
          <div
            key={st.stateCode}
            id={`state-${slug}`}
            className="bg-white rounded-2xl shadow-sm p-5 sm:p-7 scroll-mt-20"
          >
            <div className="flex items-baseline justify-between gap-3 pb-3 mb-4 border-b-2 border-brand-red/20">
              <h3 className="text-xl font-black text-neutral-900">{st.stateName}</h3>
              <Link
                href={`/events/${slug}`}
                className="text-xs font-bold text-brand-red hover:underline whitespace-nowrap"
              >
                All {st.stateCode} events →
              </Link>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed mb-6">{st.intro}</p>

            <div className="space-y-7">
              {st.groups.map((group) => (
                <div key={group.label}>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-3">
                    {group.label}
                  </h4>
                  <ul className="space-y-3">
                    {group.events.map((ev) => (
                      <li
                        key={ev.festivalId}
                        className={
                          ev.pick
                            ? "rounded-xl border-l-4 border-brand-red bg-brand-red/5 p-4"
                            : "border-l-2 border-neutral-200 pl-4 py-1"
                        }
                      >
                        {ev.pick && (
                          <span className="inline-block text-[10px] font-black uppercase tracking-wide text-white bg-brand-red rounded-full px-2 py-0.5 mb-1.5">
                            ★ Editor&rsquo;s Pick
                          </span>
                        )}
                        <p className="font-bold text-neutral-900 text-sm leading-snug">
                          <Link href={`/events/${slug}#event-${ev.festivalId}`} className="hover:text-brand-red transition-colors">
                            {ev.name}
                          </Link>
                        </p>
                        <p className="text-xs font-bold text-brand-red mt-0.5">{ev.when}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {ev.city} · {countyLabel(ev.county)}
                          {ev.venue && <> · {ev.venue}</>}
                        </p>
                        <p className="text-sm text-neutral-600 leading-relaxed mt-1.5">{ev.blurb}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-neutral-500 leading-relaxed px-1">{guide.note}</p>
    </section>
  );
}

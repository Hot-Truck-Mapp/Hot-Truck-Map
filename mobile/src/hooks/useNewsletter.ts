import { useEffect, useState } from 'react';
import { ISSUES as BUNDLED_ISSUES, type NewsletterIssue } from '@shared/newsletter';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

/**
 * Newsletter issues, newest first. Renders the copy bundled into this build
 * immediately (so the screen works offline), then swaps in the list from
 * /api/newsletter — which is how a new issue published on the website reaches
 * the app without an app release. A response older than the bundle (e.g. a
 * stale cache) is ignored.
 */
export function useNewsletterIssues(): NewsletterIssue[] {
  const [issues, setIssues] = useState<NewsletterIssue[]>(BUNDLED_ISSUES);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    fetch(`${API_BASE}/api/newsletter`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const remote = json?.issues;
        if (!Array.isArray(remote) || remote.length === 0) return;
        if ((remote[0]?.issue ?? 0) < (BUNDLED_ISSUES[0]?.issue ?? 0)) return;
        setIssues(remote as NewsletterIssue[]);
      })
      .catch(() => { /* offline or aborted — keep the bundled issues */ })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  return issues;
}

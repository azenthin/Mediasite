"use client";

import { useEffect } from 'react';

export default function MaybeAnalytics() {
  useEffect(() => {
    // Try to fetch the analytics script first. Many adblockers/extensions
    // block script element loads and the network error shows in DevTools as
    // `net::ERR_BLOCKED_BY_CLIENT`. Doing a fetch and only inserting the
    // <script> when the fetch succeeds avoids that noisy console error.
    (async () => {
      const url = '/_vercel/insights/script.js';
      try {
        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        // If fetch succeeded (status in 200-299), append the script tag so it
        // executes in the usual way. If the fetch was blocked or failed, the
        // catch handler will run and we intentionally do nothing.
        if (res && res.ok) {
          const s = document.createElement('script');
          s.src = url;
          s.async = true;
          s.onload = () => {
            // loaded
          };
          s.onerror = () => {
            // ignored intentionally
          };
          document.head.appendChild(s);
        }
      } catch (e) {
        // blocked or failed - ignore silently
      }
    })();
  }, []);

  return null;
}

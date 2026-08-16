"use client";

import { useEffect, useRef } from "react";

/**
 * Browsers don't execute <script> tags inserted via innerHTML (which is
 * what dangerouslySetInnerHTML uses under the hood) — needed for things
 * like AdSense or affiliate network embed codes that ship as a <script>
 * snippet. This re-creates each script tag manually so it actually runs.
 */
export function AdHtmlRenderer({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = html;

    const scripts = Array.from(container.querySelectorAll("script"));
    for (const oldScript of scripts) {
      const newScript = document.createElement("script");
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  return <div ref={containerRef} className="ad-slot-html" />;
}

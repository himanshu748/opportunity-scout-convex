import { normalizeSourceUrl } from "./discoveryPlan";
/** Directory pages supply leads, never proof of an open application window. */
export function directoryLinks(html: string, base: string) {
  if (
    new URL(base).hostname === "dev.to" &&
    new URL(base).pathname === "/challenges"
  )
    return devChallengeLinks(html);
  // MLH's historical section must not drown out current university leads.
  const current = html.split(/<h[1-6][^>]*>\s*Past Events/i)[0];
  const urls = new Set<string>();
  for (const match of current.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = match[2].replace(/<[^>]*>/g, " ");
    if (
      !/hack|challenge|competition|grant|bounty|fellowship|register|apply|\bevents?\b/i.test(
        label + " " + match[1],
      )
    )
      continue;
    try {
      const url = normalizeSourceUrl(
        new URL(match[1].replace(/&amp;/g, "&"), base).href,
      );
      if (url && url !== normalizeSourceUrl(base)) urls.add(url);
    } catch {
      /* malformed external link */
    }
  }
  return [...urls].slice(0, 100);
}

/** Only DEV's explicitly active section supplies candidates; fail closed on layout changes. */
export function devChallengeLinks(html: string) {
  const active =
    /<h2\b[^>]*>\s*Active Challenges\s*<\/h2>([\s\S]*?)(?=<h2\b|$)/i.exec(
      html,
    )?.[1];
  if (!active) return [];
  const urls = new Set<string>();
  for (const match of active.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    try {
      const url = normalizeSourceUrl(
        new URL(match[1].replace(/&amp;/g, "&"), "https://dev.to").href,
      );
      if (
        url &&
        new URL(url).hostname === "dev.to" &&
        new URL(url).pathname !== "/challenges"
      )
        urls.add(url);
    } catch {
      /* Ignore malformed links. */
    }
  }
  return [...urls].slice(0, 20);
}

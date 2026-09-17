import { normalizeSourceUrl } from "./discoveryPlan";
/** Directory pages supply leads, never proof of an open application window. */
export function directoryLinks(html: string, base: string) {
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

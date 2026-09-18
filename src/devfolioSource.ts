import { z } from "zod";
function pageData(html: string) {
  const raw =
    /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(
      html,
    )?.[1];
  return raw ? JSON.parse(raw) : null;
}
export function devfolioLinks(html: string): string[] {
  const data = pageData(html);
  const queries = data?.props?.pageProps?.dehydratedState?.queries ?? [];
  return [
    ...new Set<string>(
      queries.flatMap(
        (q: { state?: { data?: { open_hackathons?: { slug: string }[] } } }) =>
          (q.state?.data?.open_hackathons ?? [])
            .filter((h) => /^[-a-z\d]+$/.test(h.slug))
            .map((h) => `https://${h.slug}.devfolio.co/`),
      ),
    ),
  ].slice(0, 100);
}
const eventSchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: z.literal("HACKATHON"),
  tagline: z.string().nullish(),
  desc: z.string().nullish(),
  is_online: z.boolean(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  location: z.string().nullish(),
  team_min: z.number().nullish(),
  settings: z.object({ reg_starts_at: z.string(), reg_ends_at: z.string() }),
  themes: z
    .array(z.object({ theme: z.object({ name: z.string() }) }))
    .optional(),
});
export function devfolioOpportunity(url: string, html: string, now: number) {
  const result = eventSchema.safeParse(
    pageData(html)?.props?.pageProps?.hackathon,
  );
  if (!result.success) return null;
  const h = result.data;
  if (url !== `https://${h.slug}.devfolio.co/`) return null;
  const end = h.settings.reg_ends_at,
    start = h.settings.reg_starts_at;
  if (
    ![end, start].every(
      (s) => /(?:Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s)),
    )
  )
    return null;
  if (Date.parse(start) > now || Date.parse(end) <= now) return null;
  return {
    title: h.name,
    organization: "Devfolio organizer",
    kind: "hackathon" as const,
    description: (
      h.tagline ||
      "Applications are open on Devfolio. Read the organizer’s brief for selection stages and deliverables."
    ).slice(0, 500),
    url,
    skills: (h.themes ?? [])
      .map((t) => t.theme.name)
      .filter((t) => t !== "No Restrictions")
      .slice(0, 12),
    location: h.is_online
      ? "Online"
      : [h.location || h.city, h.country].filter(Boolean).join(", ") ||
        "Venue needs checking",
    remote: h.is_online,
    reward: "See organizer’s prize breakdown",
    deadline: Date.parse(end),
    hours: null,
    solo: h.team_min == null ? null : h.team_min === 1,
    eligibility:
      "Registration deadline shown. Check the organizer’s rules, selection stages, travel requirements and regional eligibility.",
    evidence: `Devfolio registration window: ${start} to ${end}.`,
    deadlineEvidence: `reg_ends_at: ${end}`,
    checkedAt: now,
    status: "open" as const,
    origin: "source" as const,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
}

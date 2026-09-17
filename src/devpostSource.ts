import { cashPrizeUSD } from "./opportunitySort";
export type DevpostEvent = {
  title: string;
  url: string;
  open_state: string;
  organization_name?: string;
  prize_amount?: string;
  displayed_location?: { location?: string };
  themes?: { name: string }[];
  invite_only?: boolean;
};
function plain(s: string) {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
/** Read the submission countdown, not the event end date or a model-inferred date. */
export function devpostOpportunity(
  event: DevpostEvent,
  html: string,
  now: number,
) {
  if (event.open_state !== "open" || event.invite_only) return null;
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !/^[-a-z\d]+\.devpost\.com$/i.test(url.hostname)
  )
    return null;
  const times = html.match(/<time\b[^>]*>[\s\S]*?<\/time>/gi) ?? [];
  const time = times.find((t) => /\bid=["']time-left["']/i.test(t));
  if (!time) return null;
  const iso = /\bdatetime=["']([^"']+)["']/i.exec(time)?.[1];
  if (!iso || !/(Z|[+-]\d{2}:\d{2})$/i.test(iso)) return null;
  const deadline = Date.parse(iso);
  if (!Number.isFinite(deadline) || deadline <= now) return null;
  const organization = plain(event.organization_name ?? "Devpost community");
  const themes = (event.themes ?? []).map((t) => plain(t.name)).slice(0, 8);
  const location = plain(
    event.displayed_location?.location ?? "Check the original brief",
  );
  const reward = plain(event.prize_amount ?? "");
  return {
    title: plain(event.title),
    organization,
    kind: "hackathon" as const,
    description: `A ${/online/i.test(location) ? "remote " : ""}hackathon hosted by ${organization}.${themes.length ? ` Focus: ${themes.join(", ")}.` : ""} Review the brief for deliverables and judging criteria.`,
    url: `${url.origin}/`,
    skills: themes,
    location,
    remote: /online|remote|virtual/i.test(location),
    reward:
      reward && !/^\$?0(?:\.00)?$/.test(reward)
        ? `${reward} listed prizes`
        : "See original brief for prizes",
    deadline,
    hours: null,
    solo: null,
    eligibility:
      "Check the official rules for age, geographic eligibility, and team requirements.",
    evidence: plain(time),
    checkedAt: now,
    status: "open" as const,
    origin: "source" as const,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
}

/** Confirm the platform total against the sum of explicitly USD-denominated rule awards.
 * Ambiguous currencies, mixed totals, missing rules, and mismatches fail closed. */
export function devpostCashPool(html: string, rules: string, now: number) {
  const summary = (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find(
    (a) =>
      /class=["'][^"']*\bprizes-link\b/.test(a) &&
      /href=["']#prizes["']/.test(a),
  );
  if (!summary) return {};
  const quote = plain(summary);
  if (!/^\$[\d,]+(?:\.\d+)? in cash$/.test(quote)) return {};
  const amount = cashPrizeUSD(quote);
  const awards = [...plain(rules).matchAll(/\$([\d,]+(?:\.\d+)?) in USD\b/g)];
  if (!amount || !awards.length) return {};
  const sum = awards.reduce(
    (total, award) => total + Number(award[1].replace(/,/g, "")),
    0,
  );
  if (Math.abs(sum - amount) > 0.01) return {};
  return {
    cashAmountUSD: amount,
    cashEvidence: `Overview: ${quote}. Rules: ${awards[0][0]}. USD award amounts sum to the overview cash pool.`,
    cashVerifiedAt: now,
  };
}

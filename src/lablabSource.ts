/** Use the organizer's explicit submission timeline, never schema.org endDate. */
export function lablabOpportunity(url: string, html: string, now: number) {
  if (!/^https:\/\/lablab\.ai\/ai-hackathons\/[-a-z\d]+$/.test(url))
    return null;
  const scripts = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  let event;
  for (const script of scripts) {
    try {
      const value = JSON.parse(script[1]);
      if (value["@type"] === "Event" && value.url === url) event = value;
    } catch {
      /* invalid metadata */
    }
  }
  if (
    !event ||
    event.eventStatus !== "https://schema.org/EventScheduled" ||
    event.offers?.availability !== "https://schema.org/InStock" ||
    typeof event.name !== "string"
  )
    return null;
  if (event.offers.validFrom && !(Date.parse(event.offers.validFrom) <= now))
    return null;
  // Timeline objects are serialized in Next's page payload. Decode quotes, not executable JS.
  const text = html.replace(/\\"/g, '"');
  const matches = [
    ...text.matchAll(
      /"name":"(End of Submissions!|Submission deadline|Submissions close)","showTime":true,"timestamp":"([^"\n]+)"/gi,
    ),
  ];
  const dates = [...new Set(matches.map((m) => m[2]))];
  if (dates.length !== 1 || !/GMT[+-]\d{4}/.test(dates[0])) return null;
  const deadline = Date.parse(dates[0]);
  if (!Number.isFinite(deadline) || deadline <= now) return null;
  const description = String(event.description ?? "").slice(0, 650);
  const remote =
    event.eventAttendanceMode ===
    "https://schema.org/OnlineEventAttendanceMode";
  return {
    title: event.name,
    organization: "lablab.ai",
    kind: "hackathon" as const,
    description,
    url,
    skills: ["AI"],
    location: remote
      ? "Online; check geographic eligibility"
      : "Check organizer location",
    remote,
    reward: "See organizer prize breakdown; cash pool not yet confirmed",
    deadline,
    hours: null,
    solo: null,
    eligibility:
      "Review the organizer's geographic, age, team, and technology requirements before joining.",
    evidence: `End of Submissions: ${dates[0]}`,
    deadlineEvidence: `End of Submissions: ${dates[0]}`,
    organizerEvidence: "lablab.ai event metadata and submission timeline",
    checkedAt: now,
    status: "open" as const,
    origin: "source" as const,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
}

export type Availability = {
  kind: "hackathon" | "gig" | "grant";
  status: "open" | "closed";
  origin: "source" | "example";
  deadline: number | null;
  checkedAt: number;
  acceptingSubmissions?: boolean;
  deadlineConfirmed?: boolean;
};
export function isActiveOpportunity(o: Availability, now = Date.now()) {
  if (
    o.origin !== "source" ||
    o.status !== "open" ||
    o.checkedAt > now + 60000 ||
    now - o.checkedAt > 48 * 3600000
  )
    return false;
  if (o.kind === "hackathon" || o.kind === "grant")
    return (
      o.acceptingSubmissions === true &&
      o.deadlineConfirmed === true &&
      o.deadline !== null &&
      o.deadline > now
    );
  return o.deadline === null || o.deadline > now;
}
export function isDetailUrl(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    const p = u.pathname.replace(/\/$/, "");
    if (
      /^\/(c|s)\//.test(p) ||
      [
        "/hackathons",
        "/ai-hackathons",
        "/jobs",
        "/discover",
        "/explore",
        "/events",
        "/challenges",
        "/hackathon",
      ].includes(p)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

/** Indexable upper bound for availability; never extends source freshness. */
export function availabilityUntil(o: Availability, now = Date.now()) {
  if (!isActiveOpportunity(o, now)) return 0;
  return Math.min(o.checkedAt + 48 * 3600000, o.deadline ?? Infinity);
}

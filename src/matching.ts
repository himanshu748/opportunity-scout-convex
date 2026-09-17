export type Opportunity = {
  _id: string;
  _creationTime?: number;
  title: string;
  organization: string;
  kind: "hackathon" | "gig" | "grant";
  description: string;
  url: string;
  skills: string[];
  location: string;
  remote: boolean;
  reward: string;
  cashAmount?: number;
  cashCurrency?: string;
  cashStatus?: "confirmed" | "nonCash" | "unpublished" | "ambiguous";
  cashAmountUSD?: number;
  cashEvidence?: string;
  cashVerifiedAt?: number;
  deadline: number | null;
  hours: number | null;
  solo: boolean | null;
  acceptingSubmissions?: boolean;
  deadlineConfirmed?: boolean;
  eligibleRegions?: string[];
  excludedRegions?: string[];
  regionEvidence?: string;
  organizerEvidence?: string;
  eligibility: string;
  evidence: string;
  checkedAt: number;
  status: "open" | "closed";
  origin: "source" | "example";
};
export type Profile = {
  skills: string[];
  location: string;
  hours: number;
  solo: boolean;
  goal: "learn" | "earn" | "portfolio";
};
function normalized(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}
const skillAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  "react.js": "react",
  reactjs: "react",
  "node.js": "nodejs",
  "artificial intelligence": "ai",
  "machine learning/ai": "ai",
  "machine learning": "ai",
  web: "web development",
  "web dev": "web development",
  "full-stack development": "web development",
  "user experience": "ux",
  "user interface": "ui",
};
function skillName(value: string) {
  const key = normalized(value);
  return skillAliases[key] ?? key;
}
function locationParts(value: string) {
  return value
    .split(/[,;|]/)
    .map(normalized)
    .filter(Boolean)
    .map((p) => (p === "bangalore" ? "bengaluru" : p));
}
export function matchOpportunity(
  opportunity: Opportunity,
  profile: Profile,
  now = Date.now(),
) {
  const blockers: string[] = [];
  if (
    opportunity.status === "closed" ||
    (opportunity.deadline !== null && opportunity.deadline <= now)
  )
    blockers.push("Deadline has passed");
  if (opportunity.hours !== null && opportunity.hours > profile.hours)
    blockers.push("Requires more time than your weekly budget");
  if (profile.solo && opportunity.solo === false)
    blockers.push("A team is required");
  if (
    !opportunity.remote &&
    profile.location.trim() &&
    !locationParts(opportunity.location).includes(
      locationParts(profile.location)[0],
    )
  )
    blockers.push("Location does not match");
  const regions = locationParts(profile.location);
  const knownRegion = (value: string) => regions.includes(normalized(value));
  if (
    opportunity.regionEvidence &&
    opportunity.excludedRegions?.some(knownRegion)
  )
    blockers.push("Your location is explicitly excluded by the rules");
  const matchedSkills = opportunity.skills.filter((s) =>
    profile.skills.some((p) => skillName(p) === skillName(s)),
  );
  const reasons = matchedSkills.map((s) => `${s} matches your skills`);
  if (profile.goal === "earn" && opportunity.kind === "gig")
    reasons.push("Paid work fits your earning goal");
  if (opportunity.hours !== null && opportunity.hours <= profile.hours)
    reasons.push("Fits your time budget");
  const unknowns: string[] = [];
  if (
    opportunity.eligibleRegions?.length &&
    !opportunity.eligibleRegions.some(knownRegion)
  )
    unknowns.push(
      `Residency needs checking: eligible regions are ${opportunity.eligibleRegions.join(", ")}`,
    );
  if (opportunity.remote && !opportunity.regionEvidence)
    unknowns.push("Remote does not establish geographic eligibility");
  if (!opportunity.remote && !profile.location.trim())
    unknowns.push("Add your location to check in-person opportunities");
  if (opportunity.hours === null)
    unknowns.push("Time commitment needs checking");
  if (profile.solo && opportunity.solo === null)
    unknowns.push("Solo participation needs checking");
  unknowns.push("Review the full eligibility rules before applying");
  return {
    eligible: blockers.length === 0,
    blockers,
    reasons,
    unknowns,
    score:
      matchedSkills.length * 3 +
      (profile.goal === "earn" && opportunity.kind === "gig" ? 4 : 0) +
      (opportunity.hours !== null ? 1 : 0),
  };
}

/** Rank a bounded loaded page, preserving hard constraints ahead of skill overlap. */
export function compareProfileFit(
  a: Opportunity,
  b: Opportunity,
  profile: Profile,
  now = Date.now(),
) {
  const af = matchOpportunity(a, profile, now),
    bf = matchOpportunity(b, profile, now);
  return (
    Number(bf.eligible) - Number(af.eligible) ||
    bf.score - af.score ||
    (a.deadline ?? Number.MAX_SAFE_INTEGER) -
      (b.deadline ?? Number.MAX_SAFE_INTEGER) ||
    a._id.localeCompare(b._id)
  );
}
export function profileFitLabel(
  opportunity: Opportunity,
  profile: Profile,
  now = Date.now(),
) {
  const fit = matchOpportunity(opportunity, profile, now);
  return (
    fit.blockers[0] ??
    (fit.reasons.slice(0, 2).join(" · ") ||
      "No skill match yet · check the brief")
  );
}

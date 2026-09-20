import { isActiveOpportunity } from "./availability";
import { matchOpportunity, type Opportunity, type Profile } from "./matching";
export const CANDIDATE_LIMIT = 250;
export function recommendationCheck(
  o: Opportunity,
  profile: Profile,
  now = Date.now(),
) {
  const blockers: string[] = [],
    unknowns: string[] = [];
  if (o.kind !== "hackathon")
    blockers.push("Scout currently specializes in hackathons");
  if (!isActiveOpportunity(o, now))
    blockers.push("Source no longer confirms an active submission window");
  if (o.canonicalId) blockers.push("Source alias: use the canonical event");
  if (o.conflicts?.length)
    blockers.push(`Conflicting source fields: ${o.conflicts.join(", ")}`);
  if (o.identity && !o.title.includes(o.identity.edition))
    blockers.push("Edition identity no longer matches the recorded title");
  if (o.cashAmountUSD && o.cashCurrency && o.cashCurrency !== "USD")
    blockers.push("Native currency conflicts with the USD amount");
  const fit = matchOpportunity(o, profile, now);
  blockers.push(...fit.blockers);
  unknowns.push(...fit.unknowns);
  if (
    o.eligibleRegions?.length &&
    o.regionEvidence &&
    fit.unknowns.some((s) => s.startsWith("Residency needs checking"))
  )
    blockers.push(
      "Published eligible regions do not establish your eligibility",
    );
  if (o.deadlineDate)
    unknowns.push(
      "Closing time and timezone unspecified; date-only conservative cutoff applies",
    );
  if (!o.identity)
    unknowns.push(
      "Cross-source edition identity not established; inspect the original brief",
    );
  if (o.cashStatus === "ambiguous")
    unknowns.push(
      "Mixed cash/credit details: no confirmed cash recommendation",
    );
  if (o.cashAmount || o.cashAmountUSD) {
    if (
      !o.cashEvidence ||
      !o.cashVerifiedAt ||
      now - o.cashVerifiedAt > 48 * 3600000 ||
      (o.cashStatus && o.cashStatus !== "confirmed")
    )
      blockers.push("Cash evidence is incomplete or stale");
    if ((!o.cashCurrency && !o.cashAmountUSD) || o.cashCurrency === "$")
      unknowns.push("Currency unspecified; no cross-currency ranking");
  }
  return {
    eligible: blockers.length === 0,
    blockers,
    unknowns,
    score: fit.score,
  };
}
export function selectCandidates(
  records: Opportunity[],
  profile: Profile,
  now = Date.now(),
) {
  return records
    .map((o) => ({ ...o, fit: recommendationCheck(o, profile, now) }))
    .filter((o) => o.fit.eligible)
    .sort(
      (a, b) =>
        b.fit.score - a.fit.score ||
        (a.deadline ?? Infinity) - (b.deadline ?? Infinity) ||
        a._id.localeCompare(b._id),
    )
    .slice(0, 25);
}

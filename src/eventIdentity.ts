import { normalizeSourceUrl } from "./discoveryPlan";
import type { Opportunity } from "./matching";
export type Identity = {
  organizer: string;
  edition: string;
  strongId: string;
  evidence: string;
  sourceUrl: string;
};
const norm = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
/** A title/year alone is never a cross-source identifier. IDs are organizer links
 * to specific platform events, not names, root domains or inferred current years. */
export function identityKey(i: Identity) {
  const url = normalizeSourceUrl(i.strongId);
  if (
    url &&
    /^(www|help|support|secure|info|blog)\./.test(new URL(url).hostname)
  )
    return null;
  if (
    /^(unknown|none|null|nill|devfolio organizer|organizer)$/i.test(
      i.organizer.trim(),
    )
  )
    return null;
  if (new Set(i.edition.match(/\b20\d{2}\b/g) ?? []).size !== 1) return null;
  if (
    !url ||
    !/^https:\/\/(?:[\w-]+\.devpost\.com(?:\/)?|[\w-]+\.devfolio\.co(?:\/)?|(?:www\.)?convex\.dev\/hackathons\/[\w-]+)$/.test(
      url,
    )
  )
    return null;
  if (
    !/\b20\d{2}\b/.test(i.edition) ||
    !i.evidence.includes(i.edition) ||
    !norm(i.organizer) ||
    !i.evidence.toLowerCase().includes(i.organizer.toLowerCase())
  )
    return null;
  return JSON.stringify([norm(i.organizer), norm(i.edition), url]);
}
export function extractIdentity(
  o: Pick<Opportunity, "title" | "organization" | "url">,
  text: string,
): Identity | undefined {
  const years = [...new Set(o.title.match(/\b20\d{2}\b/g) ?? [])];
  if (
    years.length !== 1 ||
    !text.includes(years[0]) ||
    !text.toLowerCase().includes(o.organization.toLowerCase())
  )
    return;
  // Only explicit event links found on this source; ambiguous multiple events abstain.
  const urls = [
    ...new Set(
      [
        o.url,
        ...Array.from(text.matchAll(/https:\/\/[^\s<>"')]+/g), (m) => m[0]),
      ]
        .map(normalizeSourceUrl)
        .filter((x): x is string => !!x),
    ),
  ];
  const evidence = text
    .split(/\n/)
    .find(
      (line) =>
        line.includes(years[0]) &&
        line.toLowerCase().includes(o.organization.toLowerCase()) &&
        line.length <= 1000,
    );
  if (!evidence) return;
  const options = urls
    .map((strongId) => ({
      organizer: o.organization,
      edition: years[0],
      strongId,
      evidence,
      sourceUrl: o.url,
    }))
    .filter(
      (i) =>
        identityKey(i) &&
        (normalizeSourceUrl(o.url) === i.strongId ||
          Array.from(evidence.matchAll(/https:\/\/[^\s<>"')]+/g), (m) =>
            normalizeSourceUrl(m[0]),
          ).includes(i.strongId)),
    );
  return options.length === 1 ? options[0] : undefined;
}
export type FieldEvidence = {
  field: string;
  value: string;
  quote: string;
  sourceUrl: string;
  checkedAt: number;
};
export function fieldEvidence(o: Opportunity): FieldEvidence[] {
  return [
    {
      field: "organizer",
      value: o.organization,
      quote: o.organizerEvidence ?? "Organizer reported by source adapter",
    },
    {
      field: "deadline",
      value: o.deadlineDate
        ? `${o.deadlineDate} (time unspecified)`
        : o.deadline === null
          ? "Unknown"
          : new Date(o.deadline).toISOString(),
      quote: o.deadlineEvidence ?? o.evidence,
    },
    { field: "reward", value: o.reward, quote: o.cashEvidence ?? o.evidence },
    {
      field: "cash",
      value: JSON.stringify([
        o.cashStatus ?? "unpublished",
        o.cashAmount ?? o.cashAmountUSD ?? null,
        o.cashCurrency ?? (o.cashAmountUSD ? "USD" : "unknown"),
      ]),
      quote: o.cashEvidence ?? "No cash evidence",
    },
    {
      field: "geography",
      value: JSON.stringify([o.eligibleRegions ?? [], o.excludedRegions ?? []]),
      quote: o.regionEvidence ?? "Geographic eligibility unknown",
    },
  ].map((f) => ({ ...f, sourceUrl: o.url, checkedAt: o.checkedAt }));
}
export function conflictsFor(records: Opportunity[]) {
  const facts = records.flatMap(fieldEvidence);
  return ["deadline", "reward", "cash", "geography"].filter(
    (field) =>
      new Set(facts.filter((f) => f.field === field).map((f) => f.value)).size >
      1,
  );
}
/** Snapshot for delivery validation; cosmetic descriptions/footers are excluded. */
export function decisionFingerprint(o: Opportunity) {
  return JSON.stringify([
    o.url,
    o.title,
    o.organization,
    o.eventKey ?? null,
    o.identity ?? null,
    o.conflicts ?? [],
    o.status,
    o.deadline,
    o.deadlineDate,
    o.deadlineConfirmed,
    o.acceptingSubmissions,
    o.remote,
    o.location,
    o.eligibleRegions,
    o.excludedRegions,
    o.regionEvidence,
    o.hours,
    o.solo,
    o.skills,
    o.reward,
    o.cashAmount,
    o.cashAmountUSD,
    o.cashCurrency,
    o.cashStatus,
    o.cashEvidence,
  ]);
}

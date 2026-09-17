export type OpportunitySort =
  "bestFit" | "endingSoon" | "endingLast" | "cash" | "prize" | "newest";
// Only an explicitly labelled USD cash amount is sortable as cash. Never count credits.
export function cashPrizeUSD(reward: string): number | null {
  const match =
    reward.match(
      /(?:US\$|USD\s*|\$)\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\s*(?:in\s+)?cash\b/i,
    ) ??
    reward.match(
      /\bcash(?:\s+prize(?:\s+pool)?)?\s*[:–-]?\s*(?:US\$|USD\s*|\$)\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\b/i,
    );
  if (!match || /(?:CAD|AUD|SGD|NZD|HKD|CA\$|AU\$|S\$)/i.test(reward))
    return null;
  const value =
    Number(match[1].replace(/,/g, "")) *
    (match[2]?.toLowerCase() === "k"
      ? 1000
      : match[2]?.toLowerCase() === "m"
        ? 1000000
        : 1);
  return Number.isFinite(value) && value > 0 ? value : null;
}
export function listedPrizeUSD(reward: string): number | null {
  if (/(?:CAD|AUD|SGD|NZD|HKD|CA\$|AU\$|S\$)/i.test(reward)) return null;
  const match = reward.match(
    /(?:US\$|USD\s*|\$)\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\s*(?:in\s+)?(?:listed\s+prizes|prize\s+pool|in\s+prizes|prizes|cash)\b/i,
  );
  if (!match) return cashPrizeUSD(reward);
  const value =
    Number(match[1].replace(/,/g, "")) *
    (match[2]?.toLowerCase() === "k"
      ? 1000
      : match[2]?.toLowerCase() === "m"
        ? 1000000
        : 1);
  return Number.isFinite(value) && value > 0 ? value : null;
}
type CashFacts = {
  cashAmountUSD?: number;
  cashEvidence?: string;
  cashVerifiedAt?: number;
};
export function confirmedCashUSD(item: CashFacts): number | null {
  if (
    !item.cashVerifiedAt ||
    !item.cashEvidence ||
    !item.cashAmountUSD ||
    item.cashAmountUSD <= 0
  )
    return null;
  return cashPrizeUSD(item.cashEvidence) === item.cashAmountUSD
    ? item.cashAmountUSD
    : null;
}
export function verifyCashEvidence(
  evidence: string,
  source: string,
): number | null {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  if (
    !evidence ||
    evidence.split(/\s+/).length > 25 ||
    !clean(source).includes(clean(evidence)) ||
    !/\b(total|pool)\b/i.test(evidence) ||
    !/(USD|US\$)/i.test(evidence)
  )
    return null;
  return cashPrizeUSD(evidence);
}
export function sortKeys(
  item: { deadline: number | null; reward: string } & CashFacts,
) {
  return {
    sortEndSoon: item.deadline ?? Number.MAX_SAFE_INTEGER,
    sortEndLast:
      item.deadline === null ? Number.MAX_SAFE_INTEGER : -item.deadline,
    sortPrize: -(listedPrizeUSD(item.reward) ?? 0),
    sortCash: -(confirmedCashUSD(item) ?? 0),
  };
}
export function compareOpportunities(
  a: {
    deadline: number | null;
    reward: string;
    cashAmountUSD?: number;
    cashEvidence?: string;
    cashVerifiedAt?: number;
    _creationTime?: number;
    _id: string;
  },
  b: typeof a,
  sort: OpportunitySort,
) {
  const ak = sortKeys(a),
    bk = sortKeys(b);
  const difference =
    sort === "newest"
      ? (b._creationTime ?? 0) - (a._creationTime ?? 0)
      : sort === "prize"
        ? ak.sortPrize - bk.sortPrize
        : sort === "cash"
          ? ak.sortCash - bk.sortCash
          : sort === "endingLast"
            ? ak.sortEndLast - bk.sortEndLast
            : ak.sortEndSoon - bk.sortEndSoon;
  return difference || a._id.localeCompare(b._id);
}

export type GroundingSource = {
  _id: string;
  title: string;
  description: string;
};
export type GroundedPick = {
  id: string;
  title: string;
  sourceQuote: string;
  why: string;
  tradeoff: string;
  nextStep: string;
  plan: string[];
};
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
/** Reject mismatched records and obvious cross-event descriptions before persistence. */
export function isGroundedPick(pick: GroundedPick, sources: GroundingSource[]) {
  const source = sources.find((s) => s._id === pick.id);
  if (!source || normalize(source.title) !== normalize(pick.title))
    return false;
  const quote = normalize(pick.sourceQuote);
  if (quote.length < 12 || !normalize(source.description).includes(quote))
    return false;
  const prose = normalize(
    [pick.why, pick.tradeoff, pick.nextStep, ...pick.plan].join(" "),
  );
  const own = normalize(source.title + " " + source.description);
  return !sources.some((other) => {
    if (other._id === source._id) return false;
    const name = normalize(other.title).split(" ")[0];
    return (
      name.length >= 5 &&
      ![
        "global",
        "build",
        "beginner",
        "hackathon",
        "challenge",
        "developer",
      ].includes(name) &&
      !own.includes(name) &&
      prose.split(" ").includes(name)
    );
  });
}

/** Monetary claims are rendered from verified records, never model prose. */
export function nonFinancialAdvice(text: string, fallback: string) {
  return /[$€£₹]|\b(cash|prizes?|rewards?|credits?|usd|usdt|dollars?|euros?|rupees?)\b/i.test(
    text,
  )
    ? fallback
    : text;
}

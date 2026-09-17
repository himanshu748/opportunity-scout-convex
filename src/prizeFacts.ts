export type PrizeFacts = {
  cashAmount?: number;
  cashCurrency?: string;
  cashStatus?: "confirmed" | "nonCash" | "unpublished" | "ambiguous";
  cashAmountUSD?: number;
  cashEvidence?: string;
  cashVerifiedAt?: number;
};
export function cashLabel(item: PrizeFacts): string {
  if (item.cashStatus === "nonCash") return "No cash · non-cash rewards";
  const amount = item.cashAmount ?? item.cashAmountUSD;
  const currency = item.cashCurrency ?? "USD";
  if (
    amount !== undefined &&
    amount > 0 &&
    item.cashEvidence &&
    item.cashVerifiedAt
  ) {
    const value = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(amount);
    return currency === "$"
      ? `$${value} cash pool · currency unspecified`
      : `${currency} ${value} confirmed cash pool`;
  }
  return item.cashStatus === "ambiguous"
    ? "Cash unclear · mixed reward details"
    : "Cash amount not published / verified";
}
function plain(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
const money =
  /^(US\$|USD\s*\$?|\$|₹|INR|€|EUR|£|GBP)\s*([\d,]+(?:\.\d+)?)\s+in cash$/i;
const number = (s: string) => Number(s.replace(/,/g, ""));
/** Reconcile the platform total with every award's value × winner count, then
 * inspect descriptions/rules: Devpost's "cash" field can contain product credits. */
export function devpostPrizeFacts(
  html: string,
  rules: string,
  now: number,
): PrizeFacts {
  const summaryHtml = (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []).find(
    (a) =>
      /class=["'][^"']*\bprizes-link\b/.test(a) &&
      /href=["']#prizes["']/.test(a),
  );
  const summary = plain(summaryHtml ?? "").replace(/\$\s+/g, "$");
  const summaryMoney = money.exec(summary);
  const cards = html
    .split(
      /<div\b[^>]*class=["'][^"']*\bprize["'][^>]*id=["']prize_\d+["'][^>]*>/i,
    )
    .slice(1)
    .map(
      (s) =>
        s.split(
          /<section\b|<h[2-5]\b|<div\b[^>]*id=["'](?:judges|judging|achievements)/i,
        )[0],
    );
  const empty: PrizeFacts = {
    cashStatus: "unpublished",
    cashVerifiedAt: now,
    cashEvidence: "The source does not publish a verifiable cash total.",
  };
  if (!cards.length) return empty;
  // Explicit non-cash / crypto summaries are not fiat cash, even when given a dollar valuation.
  if (/^\d+ non-cash prizes?$|^.+ in crypto$/i.test(summary))
    return {
      cashStatus: "nonCash",
      cashVerifiedAt: now,
      cashEvidence: `Organizer prize summary: ${summary}. No fiat cash pool is listed.`,
    };
  if (!summaryMoney) return empty;
  const currency =
    (
      {
        "₹": "INR",
        INR: "INR",
        "€": "EUR",
        EUR: "EUR",
        "£": "GBP",
        GBP: "GBP",
        US$: "USD",
        USD: "USD",
      } as Record<string, string>
    )[summaryMoney[1].trim().toUpperCase()] ?? "$";
  const rulesText = plain(rules);
  let listed = 0,
    cash = 0,
    ambiguous = false,
    usdEvidence = currency === "USD";
  let excluded = 0;
  for (const card of cards) {
    const value = plain(
      /class=["']prize-value["'][^>]*>([\s\S]*?)<\/div>/i.exec(card)?.[1] ?? "",
    ).replace(/\$\s+/g, "$");
    if (!value) continue;
    const amount = money.exec(value);
    const winners =
      /class=["']prize-winners["'][^>]*>\s*(\d+)\s+winners?/i.exec(card);
    if (!amount || !winners || amount[1].trim() !== summaryMoney[1].trim()) {
      ambiguous = true;
      continue;
    }
    const total = number(amount[2]) * Number(winners[1]);
    listed += total;
    const title = plain(
      /class=["']prize-title["'][^>]*>([\s\S]*?)<\/h6>/i.exec(card)?.[1] ?? "",
    );
    const content = plain(
      card.split(/class=["']prize-winners["'][^>]*>[\s\S]*?<\/div>/i)[1] ?? "",
    ).split("Devpost Achievements")[0];
    if (
      /compute grant|cloud credits|platform credits|subscriptions?|licenses?|scholarship|gift cards?|giftcards?|domains?/i.test(
        title,
      ) ||
      /not a cash prize|no (?:physical )?cash|cannot be (?:exchanged|redeemed) for cash/i.test(
        content,
      )
    ) {
      excluded += total;
      continue;
    }
    const escaped = amount[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const explicitCash = new RegExp(
      `\\$\\s*${escaped}\\s*(?:USD\\s*)?(?:in\\s+)?cash\\b`,
      "i",
    ).test(rulesText);
    if (
      /credits?|subscriptions?|licenses?|scholarship|gift cards?|giftcards?|domains?|membership/i.test(
        content,
      ) &&
      !explicitCash
    ) {
      ambiguous = true;
      continue;
    }
    if (
      new RegExp(`\\$\\s*${escaped}\\s*(?:in\\s+)?USD\\b`, "i").test(
        rulesText,
      ) ||
      /all (?:prize )?(?:amounts|values|prizes).{0,30}(?:USD|U\.S\. dollars)/i.test(
        rulesText,
      )
    )
      usdEvidence = true;
    cash += total;
  }
  if (Math.abs(listed - number(summaryMoney[2])) > 0.01 || ambiguous)
    return {
      cashStatus: "ambiguous",
      cashVerifiedAt: now,
      cashEvidence:
        "The platform headline and detailed reward descriptions do not establish an exact cash-only pool. Credits and other benefits are not treated as cash.",
    };
  if (cash === 0)
    return {
      cashStatus: "nonCash",
      cashVerifiedAt: now,
      cashEvidence:
        "The listed awards are non-cash benefits. Their dollar valuations are not cash payouts.",
    };
  const denomination = currency === "$" && usdEvidence ? "USD" : currency;
  const evidence = `${denomination} ${cash.toLocaleString("en-US")} cash pool: award amounts multiplied by winner counts, reconciled to the platform total.${excluded ? ` ${excluded.toLocaleString("en-US")} in non-cash benefits excluded.` : ""}`;
  return {
    cashStatus: "confirmed",
    cashAmount: cash,
    cashCurrency: denomination,
    ...(denomination === "USD" ? { cashAmountUSD: cash } : {}),
    cashEvidence: evidence,
    cashVerifiedAt: now,
  };
}

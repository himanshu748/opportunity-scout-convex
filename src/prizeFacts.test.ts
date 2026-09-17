import { expect, it } from "vitest";
import { cashLabel, devpostPrizeFacts } from "./prizeFacts";
import { lablabPrizes } from "./lablabSource";
const summary = (s: string) =>
  `<a class="prizes-link underline" href="#prizes">${s}</a>`;
const card = (
  id: number,
  title: string,
  value: string,
  count: number,
  detail = "",
) =>
  `<div class="columns prize" id="prize_${id}"><h6><div class="prize-title"><div>${title}</div></div></h6><div class="prize-content"><div class="prize-value">${value}</div><div class="prize-winners">${count} winners</div><p>${detail}</p></div></div>`;
it("multiplies award amounts by winner counts and reconciles the total", () => {
  const html =
    summary("$50,000 in cash") +
    card(1, "Grand prize", "$20,000 in cash", 2) +
    card(2, "City prizes", "$500 in cash", 20);
  const result = devpostPrizeFacts(html, "Grand prize $20,000 USD", 100);
  expect(result).toMatchObject({
    cashAmount: 50000,
    cashCurrency: "USD",
    cashStatus: "confirmed",
    cashAmountUSD: 50000,
  });
  expect(
    devpostPrizeFacts(html.replace("$50,000", "$51,000"), "", 100).cashStatus,
  ).toBe("ambiguous");
});
it("subtracts compute grants incorrectly categorized as cash by the platform", () => {
  const html =
    summary("$20,250 in cash") +
    card(1, "Main prize", "$12,000 in cash", 1) +
    card(2, "Compute Grant for AWS", "$150 in cash", 55);
  expect(devpostPrizeFacts(html, "", 100)).toMatchObject({
    cashAmount: 12000,
    cashCurrency: "$",
  });
});
it("never turns sponsor credits or mixed descriptions into cash", () => {
  expect(
    devpostPrizeFacts(
      summary("$1,000 in cash") +
        card(
          1,
          "Winner",
          "$1,000 in cash",
          1,
          "Platform credits and a subscription",
        ),
      "",
      100,
    ).cashStatus,
  ).toBe("ambiguous");
  expect(
    devpostPrizeFacts(
      summary("$1,000 in cash") +
        card(
          1,
          "Winner",
          "$1,000 in cash",
          1,
          "No physical cash will be awarded; platform credits only",
        ),
      "",
      100,
    ).cashStatus,
  ).toBe("nonCash");
});
it("keeps INR in INR and dollar currency unknown without prize-specific evidence", () => {
  const inr = devpostPrizeFacts(
    summary("₹ 50,000 in cash") + card(1, "Winner", "₹ 50,000 in cash", 1),
    "",
    100,
  );
  expect(inr).toMatchObject({ cashAmount: 50000, cashCurrency: "INR" });
  expect(inr.cashAmountUSD).toBeUndefined();
  const dollars = devpostPrizeFacts(
    summary("$5,000 in cash") + card(1, "Winner", "$5,000 in cash", 1),
    "Liability limited to USD $100.",
    100,
  );
  expect(dollars.cashCurrency).toBe("$");
  expect(cashLabel(dollars)).toContain("currency unspecified");
});
it("does not sum numbers from unrelated page text or pretend crypto is cash", () => {
  expect(devpostPrizeFacts("<p>$50,000 in cash</p>", "", 100).cashStatus).toBe(
    "unpublished",
  );
  expect(
    devpostPrizeFacts(
      summary("$750 in crypto") + card(1, "Winner", "$750 of USDT", 1),
      "",
      100,
    ).cashStatus,
  ).toBe("nonCash");
});
it("extracts a reconciled lablab cash/credits split", () => {
  expect(
    lablabPrizes("$10,000 Prize Pool ($5k cash + $5k in AAI credits)", 100),
  ).toMatchObject({ cashAmount: 5000, cashCurrency: "$" });
  expect(
    lablabPrizes("$20,000 Prize Pool ($5k cash + $5k in AAI credits)", 100),
  ).toEqual({});
});

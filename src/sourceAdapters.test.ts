import { expect, it } from "vitest";
import { allGasPrizes } from "./sourceAdapters";
import { confirmedCashUSD, sortKeys } from "./opportunitySort";
const source = `$25,000 Cash + Codex credits
## Prizes
Overall winner
$10,000 cash
* $5,000 in Codex credits
* Subscriptions and swag
Second place
$5,000 cash
* $2,500 in Codex credits
Third place
$1,500 cash
* $1,000 in Codex credits
## Qualification and judging criteria`;
it("sums cash tiers separately from credits and makes the verified total sortable", () => {
  const facts = allGasPrizes(source, 123)!;
  expect(facts.cashAmountUSD).toBe(16500);
  expect(facts.reward).toBe("$16,500 cash pool + $8,500 Codex credits");
  expect(confirmedCashUSD(facts)).toBe(16500);
  expect(sortKeys({ ...facts, deadline: null }).sortCash).toBe(-16500);
});
it("fails closed when tiers are missing, duplicated, ambiguous or do not reconcile", () => {
  for (const text of [
    source.replace("Third place", "Second place"),
    source.replace("$1,500 cash", "$1,500 prizes"),
    source.replace("$25,000", "$30,000"),
    source + " CAD",
    source.replace("$1,000 in Codex credits", "credits TBD"),
  ]) {
    expect(allGasPrizes(text, 123)).toBeNull();
  }
});
it("reads revised source amounts rather than hardcoding a cash total", () => {
  expect(
    allGasPrizes(
      source
        .replace("$25,000", "$26,000")
        .replace("$1,500 cash", "$2,500 cash"),
      123,
    )?.cashAmountUSD,
  ).toBe(17500);
});

it("does not confuse ordinary words with currency codes", () => {
  expect(allGasPrizes(source + " Claude audio", 123)?.cashAmountUSD).toBe(
    16500,
  );
});

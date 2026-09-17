import { describe, expect, it } from "vitest";
import { devpostCashPool } from "./devpostSource";
const html =
  '<a class="prizes-link underline" href="#prizes"><strong>$30,000</strong> in cash</a>';
describe("official cash pool reconciliation", () => {
  it("confirms only when USD rule awards reconcile to the platform cash total", () => {
    expect(
      devpostCashPool(html, "$20,000 in USD; $10,000 in USD", 100)
        .cashAmountUSD,
    ).toBe(30000);
    expect(devpostCashPool(html, "$20,000 in USD", 100)).toEqual({});
    expect(devpostCashPool(html, "$30,000 in CAD", 100)).toEqual({});
    expect(
      devpostCashPool(
        html.replace("in cash", "in prizes"),
        "$30,000 in USD",
        100,
      ),
    ).toEqual({});
    expect(
      devpostCashPool("<p>$30,000 in cash</p>", "$30,000 in USD", 100),
    ).toEqual({});
  });
});

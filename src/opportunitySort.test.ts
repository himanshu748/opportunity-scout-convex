import { expect, it } from "vitest";
import {
  cashPrizeUSD,
  listedPrizeUSD,
  verifyCashEvidence,
  confirmedCashUSD,
  compareOpportunities,
} from "./opportunitySort";
it("counts explicit cash while excluding credit-only or ambiguous totals", () => {
  expect(cashPrizeUSD("$25,000 in cash + $5,000 credits")).toBe(25000);
  expect(cashPrizeUSD("USD 2.5k cash")).toBe(2500);
  expect(cashPrizeUSD("$50,000 credits")).toBeNull();
  expect(cashPrizeUSD("$30,000 listed prizes")).toBeNull();
  expect(cashPrizeUSD("CAD $30,000 cash")).toBeNull();
});
it("orders deadlines both ways and always leaves missing deadlines last", () => {
  const a = { _id: "a", deadline: 100, reward: "" },
    b = { _id: "b", deadline: 200, reward: "" },
    unknown = { _id: "c", deadline: null, reward: "" };
  expect(
    [b, unknown, a]
      .sort((x, y) => compareOpportunities(x, y, "endingSoon"))
      .map((x) => x._id),
  ).toEqual(["a", "b", "c"]);
  expect(
    [a, unknown, b]
      .sort((x, y) => compareOpportunities(x, y, "endingLast"))
      .map((x) => x._id),
  ).toEqual(["b", "a", "c"]);
});
it("ranks cash and newest consistently", () => {
  const a = {
      _id: "a",
      deadline: null,
      reward: "$1,000 cash",
      cashAmountUSD: 1000,
      cashEvidence: "Total pool: USD 1,000 cash",
      cashVerifiedAt: 1,
      _creationTime: 10,
    },
    b = {
      _id: "b",
      deadline: null,
      reward: "$2,000 cash",
      cashAmountUSD: 2000,
      cashEvidence: "Total pool: USD 2,000 cash",
      cashVerifiedAt: 1,
      _creationTime: 20,
    };
  expect(compareOpportunities(a, b, "cash")).toBeGreaterThan(0);
  expect(compareOpportunities(a, b, "newest")).toBeGreaterThan(0);
});

it("keeps listed prize pools distinct from cash", () => {
  expect(listedPrizeUSD("$30,000 listed prizes")).toBe(30000);
  expect(cashPrizeUSD("$30,000 listed prizes")).toBeNull();
});

it("requires matching source evidence, currency and a total pool", () => {
  const quote = "Total pool: USD 25,000 cash";
  expect(verifyCashEvidence(quote, `Official prizes: ${quote}`)).toBe(25000);
  expect(verifyCashEvidence(quote, "A different source")).toBeNull();
  expect(
    verifyCashEvidence(
      "First prize USD 5,000 cash",
      "First prize USD 5,000 cash",
    ),
  ).toBeNull();
  expect(
    verifyCashEvidence("Total pool $5,000 cash", "Total pool $5,000 cash"),
  ).toBeNull();
  expect(confirmedCashUSD({ cashAmountUSD: 5000 })).toBeNull();
});

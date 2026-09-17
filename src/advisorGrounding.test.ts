import { expect, it } from "vitest";
import { isGroundedPick, type GroundedPick } from "./advisorGrounding";
const sources = [
  {
    _id: "a",
    title: "Hyperbloom September",
    description:
      "A beginner-friendly event for education and low-code projects.",
  },
  {
    _id: "b",
    title: "Hack2Heal 2.0",
    description: "An AI healthcare hackathon.",
  },
];
const pick: GroundedPick = {
  id: "a",
  title: "Hyperbloom September",
  sourceQuote: "education and low-code projects",
  why: "Try an education prototype.",
  tradeoff: "Check team eligibility.",
  nextStep: "Read the rules.",
  plan: ["Sketch a learning app."],
};
it("rejects the observed cross-event recommendation and wrong identities", () => {
  expect(isGroundedPick(pick, sources)).toBe(true);
  expect(
    isGroundedPick(
      { ...pick, why: "Hack2Heal focuses on healthcare." },
      sources,
    ),
  ).toBe(false);
  expect(isGroundedPick({ ...pick, title: "Hack2Heal 2.0" }, sources)).toBe(
    false,
  );
  expect(
    isGroundedPick(
      { ...pick, sourceQuote: "Offers a $1000 cash prize" },
      sources,
    ),
  ).toBe(false);
});

import { nonFinancialAdvice } from "./advisorGrounding";
it("keeps model-invented financial claims out of recommendation prose", () => {
  expect(
    nonFinancialAdvice(
      "A $740,000 pool with $100,000 confirmed cash.",
      "Read the verified reward facts.",
    ),
  ).toBe("Read the verified reward facts.");
  expect(
    nonFinancialAdvice("Build a React Native prototype.", "fallback"),
  ).toBe("Build a React Native prototype.");
});

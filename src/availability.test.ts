import { describe, it, expect } from "vitest";
import { isActiveOpportunity, isDetailUrl } from "./availability";
const now = 1000000000;
const o = {
  kind: "hackathon" as const,
  status: "open" as const,
  origin: "source" as const,
  deadline: now + 5000,
  checkedAt: now,
  acceptingSubmissions: true,
  deadlineConfirmed: true,
};
describe("only active source-confirmed hackathons", () => {
  it("shows a recently checked open hackathon before its deadline", () =>
    expect(isActiveOpportunity(o, now)).toBe(true));
  it("hides at the precise deadline and afterwards", () => {
    expect(isActiveOpportunity(o, now + 5000)).toBe(false);
    expect(isActiveOpportunity(o, now + 5001)).toBe(false);
  });
  it("hides unknown deadlines, unconfirmed dates, closed registration and examples", () => {
    for (const patch of [
      { deadline: null },
      { deadlineConfirmed: false },
      { acceptingSubmissions: false },
      { origin: "example" as const },
      { status: "closed" as const },
    ])
      expect(isActiveOpportunity({ ...o, ...patch }, now)).toBe(false);
  });
  it("fails closed when confirmation fields are missing", () =>
    expect(
      isActiveOpportunity(
        { ...o, deadlineConfirmed: undefined, acceptingSubmissions: undefined },
        now,
      ),
    ).toBe(false));
  it("hides stale evidence even when the deadline is in the future", () =>
    expect(
      isActiveOpportunity({ ...o, checkedAt: now - 49 * 3600000 }, now),
    ).toBe(false));
  it("rejects directory URLs as opportunity sources", () => {
    expect(isDetailUrl("https://devpost.com/c/artificial-intelligence")).toBe(
      false,
    );
    expect(isDetailUrl("https://lablab.ai/ai-hackathons")).toBe(false);
    expect(isDetailUrl("https://www.convex.dev/hackathons/all-gas")).toBe(true);
  });
});

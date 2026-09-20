import { opportunityCalendar } from "./calendar";
import { expect, it } from "vitest";
import {
  identityKey,
  extractIdentity,
  conflictsFor,
  decisionFingerprint,
} from "./eventIdentity";
import { selectCandidates, recommendationCheck } from "./recommendationPolicy";
import { retryPlan, canClaim, digestPeriod, WEEK } from "./deliveryPolicy";
import type { Opportunity } from "./matching";
export const now = Date.UTC(2026, 8, 20);
export const event: Opportunity = {
  _id: "a",
  title: "Build 2026",
  organization: "Acme",
  kind: "hackathon",
  description: "Build a developer tool",
  url: "https://build.devpost.com",
  skills: ["TypeScript"],
  location: "India",
  remote: true,
  reward: "USD 1000 cash pool",
  cashAmount: 1000,
  cashCurrency: "USD",
  cashAmountUSD: 1000,
  cashStatus: "confirmed",
  cashEvidence: "USD 1,000 cash pool",
  cashVerifiedAt: now,
  deadline: now + 7 * 86400000,
  hours: 8,
  solo: true,
  eligibility: "India residents",
  eligibleRegions: ["India"],
  regionEvidence: "India residents may enter",
  evidence: "Submissions open",
  checkedAt: now,
  status: "open",
  origin: "source",
  acceptingSubmissions: true,
  deadlineConfirmed: true,
};
export const profile = {
  skills: ["TypeScript"],
  location: "India",
  hours: 12,
  solo: true,
  goal: "learn" as const,
};
const identity = {
  organizer: "Acme",
  edition: "2026",
  strongId: event.url,
  evidence: "Acme Build 2026",
  sourceUrl: event.url,
};
it("groups explicit cross-source strong identifiers, not names or annual editions", () => {
  expect(identityKey(identity)).toBe(
    identityKey({ ...identity, sourceUrl: "https://acme.com/build" }),
  );
  expect(
    identityKey({ ...identity, edition: "2027", evidence: "Acme Build 2027" }),
  ).not.toBe(identityKey(identity));
  expect(identityKey({ ...identity, strongId: "https://acme.com" })).toBeNull();
  expect(identityKey({ ...identity, organizer: "Other" })).toBeNull();
  expect(
    extractIdentity(
      { ...event, title: "Build" },
      "Acme 2026 https://build.devpost.com",
    ),
  ).toBeUndefined();
  expect(
    extractIdentity(event, "Acme 2026 https://other.devpost.com"),
  ).toBeUndefined();
});
it("retains contradictory deadline and reward facts and abstains", () => {
  const conflicts = conflictsFor([
    event,
    {
      ...event,
      url: "https://acme.com/build",
      deadline: now + 86400000,
      reward: "Credits only",
      cashStatus: "nonCash",
    },
  ]);
  expect(conflicts).toEqual(
    expect.arrayContaining(["deadline", "reward", "cash"]),
  );
  expect(
    recommendationCheck({ ...event, conflicts }, profile, now).eligible,
  ).toBe(false);
});
it("preserves date-only uncertainty and does not convert it to a timestamp claim", () => {
  const result = recommendationCheck(
    { ...event, deadlineDate: "2026-09-27" },
    profile,
    now,
  );
  expect(result.unknowns.join(" ")).toContain("time and timezone unspecified");
});
it("mixed cash and credits and missing currency cannot masquerade as confirmed USD cash", () => {
  expect(
    recommendationCheck({ ...event, cashStatus: "ambiguous" }, profile, now)
      .eligible,
  ).toBe(false);
  expect(
    recommendationCheck(
      { ...event, cashCurrency: "$", cashAmountUSD: undefined },
      profile,
      now,
    ).unknowns.join(" "),
  ).toContain("Currency unspecified");
});
it("a strong candidate beyond board page one is selected", () => {
  const records = Array.from({ length: 125 }, (_, i) => ({
    ...event,
    _id: String(i),
    skills: i === 124 ? ["TypeScript"] : ["Rust"],
  }));
  expect(selectCandidates(records, profile, now)[0]._id).toBe("124");
});
it("fresh checks reject changed eligibility, stale facts and expired dates", () => {
  expect(
    recommendationCheck(
      { ...event, eligibleRegions: ["United States"] },
      profile,
      now,
    ).eligible,
  ).toBe(false);
  expect(
    recommendationCheck(
      { ...event, checkedAt: now - 49 * 3600000 },
      profile,
      now,
    ).eligible,
  ).toBe(false);
  expect(
    recommendationCheck({ ...event, deadline: now }, profile, now).eligible,
  ).toBe(false);
  expect(decisionFingerprint(event)).not.toBe(
    decisionFingerprint({ ...event, cashCurrency: "INR" }),
  );
  expect(decisionFingerprint(event)).toBe(
    decisionFingerprint({ ...event, description: "Footer changed" }),
  );
});
it("period identity survives next schedule advancement, and retry budget is finite", () => {
  expect(digestPeriod(now)).not.toBe(digestPeriod(now + WEEK));
  expect(retryPlan(1, now + WEEK, now)).toEqual({
    status: "retryable",
    retryAt: now + 60000,
  });
  expect(retryPlan(3, now + WEEK, now).status).toBe("failed");
  expect(retryPlan(1, now + 30000, now).status).toBe("failed");
  expect(
    canClaim({ status: "retryable", attempts: 1, periodEnd: now + WEEK }, now),
  ).toBe(true);
  expect(
    canClaim(
      {
        status: "composing",
        attempts: 1,
        periodEnd: now + WEEK,
        leaseUntil: now + 1,
      },
      now,
    ),
  ).toBe(false);
  expect(
    canClaim(
      { status: "queued", outboundId: "same", periodEnd: now + WEEK },
      now,
    ),
  ).toBe(false);
});

it("conflicting deadlines cannot become exact calendar reminders", () => {
  expect(() =>
    opportunityCalendar({ ...event, conflicts: ["deadline"] }, now),
  ).toThrow();
});
it("a mismatched edition or currency blocks recommendation", () => {
  expect(
    recommendationCheck(
      {
        ...event,
        identity: {
          organizer: "Acme",
          edition: "2027",
          strongId: event.url,
          sourceUrl: event.url,
          evidence: "Acme Build 2027",
        },
      },
      profile,
      now,
    ).eligible,
  ).toBe(false);
  expect(
    recommendationCheck({ ...event, cashCurrency: "INR" }, profile, now)
      .eligible,
  ).toBe(false);
});

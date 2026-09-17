import { describe, it, expect } from "vitest";
import { matchOpportunity, type Opportunity, type Profile } from "./matching";
const opportunity: Opportunity = {
  _id: "1",
  title: "Build",
  organization: "Org",
  kind: "hackathon",
  description: "",
  url: "https://example.org",
  skills: ["React"],
  location: "Anywhere",
  remote: true,
  reward: "Prize pool",
  deadline: 200,
  hours: null,
  solo: null,
  eligibility: "Unknown",
  evidence: "",
  checkedAt: 1,
  status: "open",
  origin: "source",
};
const profile: Profile = {
  skills: ["react"],
  location: "India",
  hours: 10,
  solo: true,
  goal: "learn",
};
describe("hard constraints and evidence gaps", () => {
  it("excludes expired opportunities including the deadline instant", () => {
    expect(matchOpportunity(opportunity, profile, 200).eligible).toBe(false);
  });
  it("does not turn unknown effort or team rules into verified fit", () => {
    const result = matchOpportunity(opportunity, profile, 100);
    expect(result.eligible).toBe(true);
    expect(result.unknowns).toContain(
      "Remote does not establish geographic eligibility",
    );
    expect(result.reasons).toContain("React matches your skills");
  });
  it("excludes over-budget and team-only work", () => {
    expect(
      matchOpportunity({ ...opportunity, hours: 20, solo: false }, profile, 100)
        .blockers,
    ).toHaveLength(2);
  });
  it("does not use skill fit to override location restrictions", () => {
    expect(
      matchOpportunity(
        { ...opportunity, remote: false, location: "London" },
        profile,
        100,
      ).eligible,
    ).toBe(false);
  });
});

describe("different backgrounds and regional wording", () => {
  it("recognizes common skill names without requiring the developer's stack", () => {
    expect(
      matchOpportunity(
        { ...opportunity, skills: ["JavaScript", "User Experience"] },
        { ...profile, skills: ["JS", "UX"] },
        100,
      ).reasons,
    ).toHaveLength(2);
  });
  it("matches an explicitly listed city and spelling variant", () => {
    expect(
      matchOpportunity(
        { ...opportunity, remote: false, location: "Bengaluru, India" },
        { ...profile, location: "Bangalore" },
        100,
      ).eligible,
    ).toBe(true);
  });
  it("does not silently reject a newcomer who has not entered a location", () => {
    const result = matchOpportunity(
      { ...opportunity, remote: false, location: "London" },
      { ...profile, location: "" },
      100,
    );
    expect(result.eligible).toBe(true);
    expect(result.unknowns.join(" ")).toContain("Add your location");
  });
  it("does not match partial city names", () => {
    expect(
      matchOpportunity(
        { ...opportunity, remote: false, location: "New York" },
        { ...profile, location: "York" },
        100,
      ).eligible,
    ).toBe(false);
  });
});

it("does not match different cities just because their country matches", () => {
  expect(
    matchOpportunity(
      { ...opportunity, remote: false, location: "Manchester, UK" },
      { ...profile, location: "London, UK" },
      100,
    ).eligible,
  ).toBe(false);
});

it("respects explicitly evidenced exclusions even for remote grants", () => {
  expect(
    matchOpportunity(
      {
        ...opportunity,
        kind: "grant",
        excludedRegions: ["India"],
        regionEvidence: "Applicants in India are excluded",
      },
      profile,
      100,
    ).eligible,
  ).toBe(false);
});
it("does not claim eligibility from a remote label", () => {
  expect(
    matchOpportunity(
      {
        ...opportunity,
        kind: "grant",
        eligibleRegions: ["Canada"],
        regionEvidence: "Canadian residents only",
      },
      profile,
      100,
    ).unknowns,
  ).toContain("Residency needs checking: eligible regions are Canada");
});

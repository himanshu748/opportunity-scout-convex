import { describe, it, expect } from "vitest";
import { opportunityCalendar } from "./calendar";
import type { Opportunity } from "./matching";
const now = Date.UTC(2026, 8, 16);
const item: Opportunity = {
  _id: "test",
  title: "Build, together; now",
  organization: "Organizer",
  kind: "hackathon",
  description: "",
  url: "https://example.com/event",
  skills: [],
  location: "Worldwide",
  remote: true,
  reward: "See rules",
  deadline: now + 2 * 86400000,
  hours: null,
  solo: null,
  eligibility: "Check rules",
  evidence: "",
  checkedAt: now,
  status: "open",
  origin: "source",
  deadlineConfirmed: true,
  acceptingSubmissions: true,
};
describe("deadline calendar", () => {
  it("preserves exact UTC deadline and includes an advance reminder", () => {
    const result = opportunityCalendar(item, now);
    expect(result).toContain("DTSTART:20260918T000000Z");
    expect(result).toContain("TRIGGER:-P1D");
    expect(result).toContain("Build\\, together\\; now");
  });
  it("rejects expired and unconfirmed events", () => {
    expect(() =>
      opportunityCalendar({ ...item, deadline: now }, now),
    ).toThrow();
    expect(() =>
      opportunityCalendar({ ...item, deadlineConfirmed: false }, now),
    ).toThrow();
  });
  it("escapes injected lines and folds Unicode at byte boundaries", () => {
    const result = opportunityCalendar(
      { ...item, title: "é".repeat(80) + "\nBEGIN:VEVENT" },
      now,
    );
    expect(
      result.split("\r\n").filter((x) => x === "BEGIN:VEVENT"),
    ).toHaveLength(1);
    for (const line of result.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it("does not schedule reminders in the past", () => {
    expect(
      opportunityCalendar({ ...item, deadline: now + 60000 }, now),
    ).not.toContain("VALARM");
  });
});

it("does not export a conservative date-only cutoff as an exact calendar appointment", () => {
  expect(() =>
    opportunityCalendar({ ...item, deadlineDate: "2026-09-27" }, now),
  ).toThrow();
});

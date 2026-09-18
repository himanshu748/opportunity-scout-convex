import { expect, it } from "vitest";
import { dateOnlyDeadline } from "./dateOnlyDeadline";
import { deadlineLabel } from "./deadline";
it("verifies an explicit calendar deadline without inventing a time", () => {
  const q = "Registration & first submission deadline 27 Sept 2026";
  expect(dateOnlyDeadline("2026-09-27", q, q)).toBe(Date.UTC(2026, 8, 26, 10));
  expect(deadlineLabel(Date.UTC(2026, 8, 26, 10), 0, "2026-09-27")).toBe(
    "Closes 2026-09-27 · time unspecified",
  );
});
it("rejects nonexistent dates, mismatched dates, missing years and event end dates", () => {
  for (const [d, q] of [
    ["2026-02-30", "Submission deadline 30 Feb 2026"],
    ["2026-09-28", "Submission deadline 27 Sept 2026"],
    ["2026-09-27", "Submission deadline 27 Sept"],
    ["2026-09-27", "Event ends 27 Sept 2026"],
  ])
    expect(dateOnlyDeadline(d, q, q)).toBeNull();
});

import { expect, it } from "vitest";
import { verifiesDeadline } from "./deadlineEvidence";
it("requires a source-backed application date, time and timezone, not an event ending", () => {
  const quote = "October 1, 2026 — applications close, 11:59 p.m. US ET";
  expect(verifiesDeadline("2026-10-01T23:59:00-04:00", quote, quote)).toBe(
    true,
  );
  expect(verifiesDeadline("2026-10-01T23:59:00Z", quote, quote)).toBe(false);
  expect(
    verifiesDeadline("2026-10-01T23:59:00-04:00", quote, "different source"),
  ).toBe(false);
  const event = "Winner Announcement October 4, 2026 23:59 UTC";
  expect(verifiesDeadline("2026-10-04T23:59:00Z", event, event)).toBe(false);
  const unknown = "Submission deadline October 4, 2026";
  expect(verifiesDeadline("2026-10-04T23:59:59Z", unknown, unknown)).toBe(
    false,
  );
});

import { rConsortiumSource } from "./sourceAdapters";
it("keeps the independently checked R grant in Eastern daylight time and does not roll the date forward", () => {
  const url =
    "https://r-consortium.org/posts/r-consortium-now-accepting-submissions-for-technical-grants/index.html";
  const page =
    "R Consortium is now accepting proposals; closes October 1, 2026, at 11:59 p.m. US Eastern Time";
  expect(rConsortiumSource(url, page, Date.parse("2026-09-17"))?.deadline).toBe(
    Date.parse("2026-10-02T03:59:00Z"),
  );
  expect(
    rConsortiumSource(
      url,
      page.replace("2026", "2027"),
      Date.parse("2026-09-17"),
    ),
  ).toBeNull();
  expect(
    rConsortiumSource(url, page, Date.parse("2026-10-02T04:00:00Z")),
  ).toBeNull();
});

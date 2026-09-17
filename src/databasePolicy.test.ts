import { expect, it } from "vitest";
import { availabilityUntil } from "./availability";
it("bounds indexed availability by both deadline and source freshness", () => {
  const now = 1000;
  const event = {
    kind: "hackathon" as const,
    status: "open" as const,
    origin: "source" as const,
    checkedAt: now,
    deadline: now + 10000,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
  expect(availabilityUntil(event, now)).toBe(event.deadline);
  expect(
    availabilityUntil({ ...event, deadline: now + 72 * 3600000 }, now),
  ).toBe(now + 48 * 3600000);
  expect(availabilityUntil({ ...event, deadlineConfirmed: false }, now)).toBe(
    0,
  );
  expect(availabilityUntil({ ...event, status: "closed" }, now)).toBe(0);
  expect(availabilityUntil({ ...event, deadline: now }, now)).toBe(0);
});

import { expect, it } from "vitest";
import { hack2skillOpportunity } from "./hack2skillSource";
const url = "https://hack2skill.com/event/example";
const html =
  "<h1>AI Learning Hackathon</h1><p>Registration &amp; first submission deadline 27 Sept 2026</p><p>2-4 Member Teams Indian citizens Hybrid Cash awards worth ₹ 10 Lakhs</p>";
it("reads the actual first-round deadline and separates INR cash from other awards", () => {
  const event = hack2skillOpportunity(url, html, Date.UTC(2026, 8, 18));
  expect(event?.deadlineDate).toBe("2026-09-27");
  expect(event?.cashAmount).toBe(1000000);
  expect(event?.cashCurrency).toBe("INR");
  expect(event?.remote).toBe(false);
  expect(event?.solo).toBe(false);
});
it("does not use final event dates, unrelated hosts or expired application windows", () => {
  expect(
    hack2skillOpportunity(
      url,
      html.replace("Registration &amp; first submission deadline", "Finale"),
      Date.UTC(2026, 8, 18),
    ),
  ).toBeNull();
  expect(
    hack2skillOpportunity(
      "https://example.org/event/example",
      html,
      Date.UTC(2026, 8, 18),
    ),
  ).toBeNull();
  expect(hack2skillOpportunity(url, html, Date.UTC(2026, 8, 27))).toBeNull();
});

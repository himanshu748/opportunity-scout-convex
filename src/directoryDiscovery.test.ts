import { expect, it } from "vitest";
import { directoryLinks } from "./directoryDiscovery";
import { normalizeSourceUrl, discoveryQueries } from "./discoveryPlan";
import { lablabOpportunity } from "./lablabSource";
import { verifiesDeadline } from "./deadlineEvidence";
it("discovers organizer links, deduplicates tracked URLs, and excludes X", () => {
  expect(
    directoryLinks(
      '<a href="https://hackuni.edu/?utm_source=mlh">Hack University</a><a href="https://hackuni.edu/">Hack University</a><a href="https://x.com/hack">Hack</a><a href="/login">Register</a>',
      "https://www.mlh.com/events",
    ),
  ).toEqual(["https://hackuni.edu/"]);
  expect(normalizeSourceUrl("https://event.devpost.com/rules?ref=home")).toBe(
    "https://event.devpost.com/",
  );
  expect(normalizeSourceUrl("https://172.16.0.1/event")).toBeNull();
});
it("covers all platform searches across a two-day rotation", () => {
  const queries = [
    ...discoveryQueries(Date.UTC(2026, 8, 17)),
    ...discoveryQueries(Date.UTC(2026, 8, 18)),
  ].join(" ");
  for (const domain of [
    "devfolio.co",
    "dorahacks.io",
    "mlh.com",
    "unstop.com",
    "lablab.ai",
    "hackerearth.com",
    "taikai.network",
  ])
    expect(queries).toContain(domain);
});
const url = "https://lablab.ai/ai-hackathons/test-event";
const now = Date.UTC(2026, 8, 17);
const metadata = {
  "@type": "Event",
  url,
  name: "Test event",
  eventStatus: "https://schema.org/EventScheduled",
  offers: {
    availability: "https://schema.org/InStock",
    validFrom: "2026-09-01T00:00:00Z",
  },
};
const html = `<script type="application/ld+json">${JSON.stringify(metadata)}</script>`;
const timeline =
  '"name":"End of Submissions!","showTime":true,"timestamp":"Wed Sep 30 2026 19:00:00 GMT+0400 (Gulf Standard Time)"';
it("verifies an explicit lablab submission timestamp, not the event end", () => {
  expect(lablabOpportunity(url, html + timeline, now)?.deadline).toBe(
    Date.UTC(2026, 8, 30, 15),
  );
  expect(lablabOpportunity(url, html, now)).toBeNull();
  expect(
    lablabOpportunity(
      url,
      html + timeline.replace("End of Submissions!", "Event ends"),
      now,
    ),
  ).toBeNull();
  expect(
    lablabOpportunity(url, html + timeline, Date.UTC(2026, 9, 1)),
  ).toBeNull();
  expect(
    lablabOpportunity(
      url,
      (html + timeline).replace("InStock", "SoldOut"),
      now,
    ),
  ).toBeNull();
});
it("handles explicit Asian deadline timezones and rejects mismatched instants", () => {
  const quote = "Submissions close September 30, 2026 at 19:00 GMT+0400";
  expect(verifiesDeadline("2026-09-30T15:00:00Z", quote, quote)).toBe(true);
  expect(verifiesDeadline("2026-09-30T19:00:00Z", quote, quote)).toBe(false);
  const india =
    "Submission deadline September 30, 2026 at 20:30 India Standard Time";
  expect(verifiesDeadline("2026-09-30T15:00:00Z", india, india)).toBe(true);
});

it("takes only active DEV challenge detail links, excluding upcoming and archives", () => {
  const html = `<h2>Active Challenges</h2>
    <a href="/mlh-hackathon">Monthly writing</a>
    <a href="/mlh-hackathon?utm_source=dev">Duplicate</a>
    <a href="https://example.com/challenge">External</a>
    <h2>Launching Soon</h2><a href="/challenges/upcoming">Upcoming</a>
    <h2>Past Challenges</h2><a href="/challenges/old">Old</a>`;
  expect(directoryLinks(html, "https://dev.to/challenges")).toEqual([
    "https://dev.to/mlh-hackathon",
  ]);
  expect(
    directoryLinks(
      '<h2>Past Challenges</h2><a href="/old">Challenge</a>',
      "https://dev.to/challenges",
    ),
  ).toEqual([]);
});

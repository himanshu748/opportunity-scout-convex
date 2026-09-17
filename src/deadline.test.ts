import { describe, it, expect } from "vitest";
import { deadlineLabel } from "./deadline";
import {
  discoveryQueries,
  normalizeSourceUrl,
  opportunityLinks,
} from "./discoveryPlan";
describe("deadline clock", () => {
  it("never displays negative remaining time", () => {
    expect(deadlineLabel(1000, 1001)).toBe("Deadline reached");
    expect(deadlineLabel(1000, 1000)).toBe("Deadline reached");
  });
  it("keeps the final second visible until the cutoff", () =>
    expect(deadlineLabel(1000, 999)).toBe("0h 00m 01s left"));
  it("formats multi-day deadlines", () =>
    expect(deadlineLabel(90061000, 0)).toBe("1d 1h 1m left"));
});
describe("discovery breadth and provenance", () => {
  it("rotates through all 24 themes across four daily runs", () => {
    const base = Date.UTC(2026, 8, 14);
    expect(
      new Set(
        [0, 1, 2, 3].flatMap((i) => discoveryQueries(base + i * 24 * 3600000)),
      ).size,
    ).toBe(41);
  });
  it("deduplicates tracking links and rejects private destinations", () => {
    expect(
      normalizeSourceUrl("https://example.com/hack?utm_source=x#apply"),
    ).toBe("https://example.com/hack");
    expect(normalizeSourceUrl("https://127.0.0.1/hack")).toBeNull();
  });
  it("follows obscure event links from community articles", () =>
    expect(
      opportunityLinks(
        "[Register for our hackathon](/event/new) [About](/about)",
        "https://community.org/post",
      ),
    ).toEqual(["https://community.org/event/new"]));
});

import { transitionOpportunities } from "./useExpiringOpportunities";
import type { Opportunity } from "./matching";
it("keeps only a non-interactive exit copy at deadline then removes it", () => {
  const o = {
    _id: "test",
    kind: "hackathon",
    origin: "source",
    status: "open",
    acceptingSubmissions: true,
    deadlineConfirmed: true,
    deadline: 10000,
    checkedAt: 5000,
  } as Opportunity;
  expect(transitionOpportunities([o], [], 10000)[0].departingAt).toBe(10000);
  expect(
    transitionOpportunities([{ ...o, departingAt: 10000 }], [], 10650),
  ).toEqual([]);
  expect(transitionOpportunities([o], [], 9000)).toEqual([]);
});

import { allGasSource } from "./sourceAdapters";
it("requires the official source evidence and never rolls the All Gas deadline forward", () => {
  const text =
    "Submissions are due Sep 22, 12:00 PM PT. Only new apps started on or after August 25";
  expect(
    allGasSource(
      "https://www.convex.dev/hackathons/all-gas",
      text,
      Date.UTC(2026, 8, 14),
    )?.deadline,
  ).toBe(1790103600000);
  expect(
    allGasSource(
      "https://www.convex.dev/hackathons/all-gas",
      "missing deadline",
      Date.UTC(2026, 8, 14),
    ),
  ).toBeNull();
  expect(
    allGasSource(
      "https://www.convex.dev/hackathons/all-gas",
      text,
      1790103600000,
    ),
  ).toBeNull();
});

import { sourcePriority } from "./discoveryPlan";
it("rejects links that polluted the old crawl queue", () => {
  for (const url of [
    "https://images.lumacdn.com/event.png",
    "https://github.com/login?return_to=hackathon",
    "https://github.com/team/hackathon/commits/main",
    "https://dev.to/new?prefill=hackathon",
  ])
    expect(normalizeSourceUrl(url)).toBeNull();
  expect(
    normalizeSourceUrl(
      "https://call-e.devpost.com/?ref_feature=challenge&ref_medium=discover",
    ),
  ).toBe("https://call-e.devpost.com/");
  expect(sourcePriority("https://call-e.devpost.com/")).toBeLessThan(
    sourcePriority("https://luma.com/sf"),
  );
});

import { devpostOpportunity } from "./devpostSource";
it("reads the platform submission deadline with its timezone and rejects inferred dates", () => {
  const event = {
    title: "A real hackathon",
    url: "https://test.devpost.com/",
    open_state: "open",
  };
  const now = Date.UTC(2026, 8, 14);
  const html =
    '<time class="value" datetime="2026-09-14T11:45:00-04:00" id="time-left">September 14 at 11:45am EDT</time>';
  expect(devpostOpportunity(event, html, now)?.deadline).toBe(
    Date.UTC(2026, 8, 14, 15, 45),
  );
  expect(
    devpostOpportunity(event, html, Date.UTC(2026, 8, 14, 15, 45)),
  ).toBeNull();
  expect(
    devpostOpportunity({ ...event, open_state: "closed" }, html, now),
  ).toBeNull();
  expect(devpostOpportunity(event, html.replace("-04:00", ""), now)).toBeNull();
  expect(
    devpostOpportunity(
      event,
      '<time datetime="2027-01-01T00:00:00Z">event end</time>',
      now,
    ),
  ).toBeNull();
});

it("does not send X posts or shortlinks to the scraping queue", () => {
  for (const host of [
    "x.com",
    "www.x.com",
    "twitter.com",
    "mobile.twitter.com",
    "t.co",
  ])
    expect(normalizeSourceUrl(`https://${host}/announcement`)).toBeNull();
});

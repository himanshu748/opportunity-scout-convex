import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);
const now = Date.UTC(2026, 8, 22);
const event = {
  title: "Community Build",
  organization: "Builders",
  kind: "hackathon" as const,
  description: "Build together",
  url: "https://example.com/event",
  skills: ["TypeScript"],
  location: "Online",
  remote: true,
  reward: "Credits",
  deadline: now + 86400000,
  hours: null,
  solo: null,
  eligibility: "Check rules",
  evidence: "Submissions open",
  checkedAt: now,
  status: "open" as const,
  origin: "source" as const,
  acceptingSubmissions: true,
  deadlineConfirmed: true,
  searchText: "Community Build Builders TypeScript",
  sortEndSoon: now + 86400000,
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());
it("fills the first page with active records even after fifty stale records", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let i = 0; i < 55; i++)
      await ctx.db.insert("opportunities", {
        ...event,
        checkedAt: now - 49 * 3600000,
      });
    await ctx.db.insert("opportunities", { ...event, title: "Visible event" });
  });
  const result = await t.query(api.board.page, {
    asOf: now,
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(result.page.map((o) => o.title)).toEqual(["Visible event"]);
  expect(result.isDone).toBe(true);
});
it("keeps pagination stable while server time advances", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let i = 0; i < 12; i++)
      await ctx.db.insert("opportunities", { ...event, title: `Event ${i}` });
  });
  const first = await t.query(api.board.page, {
    asOf: now,
    paginationOpts: { cursor: null, numItems: 10 },
  });
  vi.setSystemTime(now + 10000);
  const second = await t.query(api.board.page, {
    asOf: now,
    paginationOpts: { cursor: first.continueCursor, numItems: 10 },
  });
  expect(first.page).toHaveLength(10);
  expect(second.page).toHaveLength(2);
  expect(second.isDone).toBe(true);
});
it("never lets a client snapshot revive stale or expired records", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("opportunities", {
      ...event,
      checkedAt: now - 49 * 3600000,
    });
    await ctx.db.insert("opportunities", { ...event, deadline: now - 1 });
    await ctx.db.insert("opportunities", {
      ...event,
      checkedAt: now + 3600000,
    });
  });
  const result = await t.query(api.board.page, {
    asOf: now - 7 * 86400000,
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(result.page).toEqual([]);
});
it("finds a matching event beyond the first unfiltered page", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let i = 0; i < 55; i++) await ctx.db.insert("opportunities", event);
    await ctx.db.insert("opportunities", {
      ...event,
      title: "Orbit hack",
      searchText: "Orbit hack Builders Rust",
    });
  });
  const result = await t.query(api.board.page, {
    asOf: now,
    search: "Orbit",
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(result.page.map((o) => o.title)).toEqual(["Orbit hack"]);
});
it("reports unconfirmed and stale leads separately from the verified count", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("opportunities", event);
    await ctx.db.insert("opportunities", {
      ...event,
      checkedAt: now - 49 * 3600000,
    });
    await ctx.db.insert("opportunities", {
      ...event,
      deadlineConfirmed: false,
    });
    await ctx.db.insert("opportunities", { ...event, deadline: now - 1 });
  });
  const result = await t.query(api.board.coverage, {});
  expect(result.active).toBe(1);
  expect(result.pending).toBe(2);
  expect(result.pendingExamples.map((o) => o.reason)).toContain(
    "Source check is older than 48 hours",
  );
});
it("refreshes known events without starving older discovery work", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("sourceQueue", {
      url: "https://example.com/new",
      channel: "search",
      nextCheckAt: now - 10000,
      attempts: 0,
    });
    await ctx.db.insert("sourceQueue", {
      url: "https://example.com/known",
      channel: "search",
      nextCheckAt: now - 1000,
      attempts: 1,
      result: "active",
    });
  });
  expect(
    (await t.mutation(internal.discovery.claim, { preferActive: true }))?.url,
  ).toBe("https://example.com/known");
  expect(
    (await t.mutation(internal.discovery.claim, { preferActive: false }))?.url,
  ).toBe("https://example.com/new");
});

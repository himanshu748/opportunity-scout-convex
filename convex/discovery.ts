import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizeSourceUrl } from "../src/discoveryPlan";
export const enqueue = internalMutation({
  args: {
    urls: v.array(v.string()),
    channel: v.string(),
    depth: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let added = 0;
    for (const raw of args.urls.slice(0, 100)) {
      const url = normalizeSourceUrl(raw);
      if (!url) continue;
      const existing = await ctx.db
        .query("sourceQueue")
        .withIndex("by_url", (q) => q.eq("url", url))
        .unique();
      if (!existing) {
        await ctx.db.insert("sourceQueue", {
          url,
          channel: args.channel.slice(0, 160),
          depth: args.depth ?? 0,
          nextCheckAt: Date.now(),
          attempts: 0,
        });
        added++;
      }
    }
    return added;
  },
});
export const claim = internalMutation({
  args: { url: v.optional(v.string()), preferActive: v.optional(v.boolean()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const refresh =
      !args.url && args.preferActive
        ? await ctx.db
            .query("sourceQueue")
            .withIndex("by_result_nextCheckAt", (q) =>
              q.eq("result", "active").lte("nextCheckAt", now),
            )
            .first()
        : null;
    const item = args.url
      ? await ctx.db
          .query("sourceQueue")
          .withIndex("by_url", (q) => q.eq("url", args.url!))
          .unique()
      : (refresh ??
        (await ctx.db
          .query("sourceQueue")
          .withIndex("by_nextCheckAt", (q) => q.lte("nextCheckAt", now))
          .first()));
    if (!item || (item.leaseUntil ?? 0) > now) return null;
    await ctx.db.patch(item._id, {
      leaseUntil: now + 5 * 60000,
      nextCheckAt: now + 5 * 60000,
      attempts: item.attempts + 1,
    });
    return item;
  },
});
export const complete = internalMutation({
  args: {
    id: v.id("sourceQueue"),
    result: v.string(),
    retry: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.id);
    if (!source) return null;
    const retryCount = args.retry ? (source.retryCount ?? 0) + 1 : 0;
    await ctx.db.patch(args.id, {
      retryCount,
      result: args.result,
      leaseUntil: 0,
      lastCheckedAt: Date.now(),
      nextCheckAt:
        Date.now() +
        (args.retry
          ? Math.min(24, 2 ** Math.min(retryCount - 1, 5)) * 3600000
          : args.result === "active"
            ? 24 * 3600000
            : 7 * 86400000),
    });
    return null;
  },
});
export const existing = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("opportunities")
        .withIndex("by_status_and_kind", (q) => q.eq("status", "open"))
        .take(100)
    ).map((o) => o.url),
});
export const request = mutation({
  args: { topic: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, { topic }) => {
    if (!(await getAuthUserId(ctx)))
      throw new ConvexError("Sign in to start a web search.");
    if (topic && topic.length > 120)
      throw new ConvexError("Keep your search under 120 characters.");
    const recent = await ctx.db
      .query("runs")
      .withIndex("by_kind", (q) => q.eq("kind", "requested-discovery"))
      .order("desc")
      .first();
    if (recent && Date.now() - recent.startedAt < 15 * 60000)
      return "Scout is already searching. New verified finds will appear automatically.";
    await ctx.db.insert("runs", {
      kind: "requested-discovery",
      status: "done",
      message: "Web discovery requested",
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ingest.refresh, {
      topic: topic?.trim(),
    });
    return "Searching sponsor, community, university, and niche sources. Verified finds will appear as they are checked.";
  },
});
export const status = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("runs")
      .withIndex("by_kind", (q) => q.eq("kind", "source-refresh"))
      .order("desc")
      .first();
    const stats = await ctx.db
      .query("sourceStats")
      .withIndex("by_name", (q) => q.eq("name", "sources"))
      .unique();
    const lease = await ctx.db
      .query("sourceQueue")
      .withIndex("by_leaseUntil", (q) => q.gt("leaseUntil", Date.now()))
      .first();
    return {
      searching: latest?.status === "running" || !!lease,
      pending: stats?.pending ?? 0,
      failed: stats?.failed ?? 0,
      active: stats?.active ?? 0,
      sources: stats?.sources ?? 0,
      checked: stats?.checked ?? 0,
      countsUpdatedAt: stats?.updatedAt ?? null,
      lastRun: latest?.finishedAt ?? null,
      summary: latest?.message ?? "No web search has run yet.",
    };
  },
});

export const retryBlocked = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const blocked = (await ctx.db.query("sourceQueue").take(2000)).filter((s) =>
      /rate limit|Source check failed/i.test(s.result ?? ""),
    );
    for (const s of blocked)
      await ctx.db.patch(s._id, { nextCheckAt: Date.now(), leaseUntil: 0 });
    return blocked.length;
  },
});
export const hasWork = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) =>
    !!(await ctx.db
      .query("sourceQueue")
      .withIndex("by_nextCheckAt", (q) => q.lte("nextCheckAt", Date.now()))
      .first()),
});

export const pruneNoise = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const noise = (await ctx.db.query("sourceQueue").take(2000)).filter(
      (s) => !normalizeSourceUrl(s.url),
    );
    for (const s of noise)
      await ctx.db.patch(s._id, {
        result: "Ignored asset or navigation URL",
        lastCheckedAt: Date.now(),
        nextCheckAt: Date.now() + 365 * 86400000,
        leaseUntil: 0,
      });
    return noise.length;
  },
});
export const imported = internalMutation({
  args: { url: v.string() },
  returns: v.null(),
  handler: async (ctx, { url }) => {
    const source = await ctx.db
      .query("sourceQueue")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique();
    const fields = {
      result: "active",
      lastCheckedAt: Date.now(),
      nextCheckAt: Date.now() + 86400000,
      leaseUntil: 0,
    };
    if (source)
      await ctx.db.patch(source._id, {
        ...fields,
        attempts: source.attempts + 1,
      });
    else
      await ctx.db.insert("sourceQueue", {
        ...fields,
        url,
        channel: "Devpost verified submission timer",
        depth: 0,
        attempts: 1,
      });
    return null;
  },
});

const counts = {
  sources: v.number(),
  checked: v.number(),
  pending: v.number(),
  failed: v.number(),
  active: v.number(),
};
export const refreshStats = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    totals: v.optional(v.object(counts)),
    startedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = args.startedAt ?? Date.now();
    const totals = args.totals ?? {
      sources: 0,
      checked: 0,
      pending: 0,
      failed: 0,
      active: 0,
    };
    const batch = await ctx.db
      .query("sourceQueue")
      .paginate({ cursor: args.cursor ?? null, numItems: 200 });
    for (const source of batch.page) {
      totals.sources++;
      const failed =
        !!source.result?.includes("retry") ||
        source.result === "Source check failed";
      if (source.lastCheckedAt) totals.checked++;
      if (!source.lastCheckedAt || failed) totals.pending++;
      if (failed) totals.failed++;
      if (source.result === "active") totals.active++;
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(0, internal.discovery.refreshStats, {
        cursor: batch.continueCursor,
        totals,
        startedAt,
      });
    else {
      const existing = await ctx.db
        .query("sourceStats")
        .withIndex("by_name", (q) => q.eq("name", "sources"))
        .unique();
      if (!existing)
        await ctx.db.insert("sourceStats", {
          name: "sources",
          ...totals,
          updatedAt: startedAt,
        });
      else if (existing.updatedAt <= startedAt)
        await ctx.db.patch(existing._id, { ...totals, updatedAt: startedAt });
    }
    return null;
  },
});

// A single lease coordinates cron, manual discovery, and queued continuations.
export const acquireWorker = internalMutation({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const now = Date.now();
    const lease = await ctx.db
      .query("discoveryWorker")
      .withIndex("by_name", (q) => q.eq("name", "drain"))
      .unique();
    if (lease && lease.expiresAt > now) return null;
    const token = `${now}:${Math.random()}`;
    const value = { name: "drain", token, expiresAt: now + 15 * 60000 };
    if (lease) await ctx.db.patch(lease._id, value);
    else await ctx.db.insert("discoveryWorker", value);
    return token;
  },
});
export const releaseWorker = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lease = await ctx.db
      .query("discoveryWorker")
      .withIndex("by_name", (q) => q.eq("name", "drain"))
      .unique();
    if (lease?.token === args.token)
      await ctx.db.patch(lease._id, { expiresAt: 0 });
    return null;
  },
});

/** Community links enter the same verification queue, never the public catalog directly. */
export const submitSource = mutation({
  args: { url: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to submit an opportunity.");
    const url =
      args.url.length <= 2000 ? normalizeSourceUrl(args.url.trim()) : null;
    if (!url)
      throw new ConvexError(
        "Use a public HTTPS organizer or event link. X links are not supported.",
      );
    const recent = await ctx.db
      .query("sourceSubmissions")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", userId).gt("submittedAt", Date.now() - 86400000),
      )
      .take(5);
    if (recent.length >= 5)
      throw new ConvexError(
        "You can suggest five opportunities per day. Try again tomorrow.",
      );
    const existing = await ctx.db
      .query("sourceQueue")
      .withIndex("by_url", (q) => q.eq("url", url))
      .unique();
    if (existing) {
      if (existing.result === "active")
        return "This source was previously verified. If it is missing, its deadline may have passed or its source check may need refreshing.";
      if (/retry|failed|rate limit/i.test(existing.result ?? ""))
        return "This source could not be checked. It is queued for retry; it has not been confirmed closed.";
      if (!existing.lastCheckedAt)
        return "This link is in the verification queue. It will appear once its submission window and closing date are confirmed.";
      return "We found this source, but could not confirm an open submission window and deadline. It is scheduled for another check.";
    }
    await ctx.db.insert("sourceSubmissions", {
      userId,
      url,
      submittedAt: Date.now(),
    });
    await ctx.db.insert("sourceQueue", {
      url,
      channel: "Community suggestion",
      depth: 0,
      nextCheckAt: Date.now(),
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.ingest.drain, {});
    return "Link submitted for verification. We’ll check the organizer and deadline before listing it.";
  },
});

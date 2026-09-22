import { normalizeSourceUrl } from "../src/discoveryPlan";
import { fieldEvidence, identityKey } from "../src/eventIdentity";
import { reconcileIdentity, resolveRecord } from "./identity";
import { sortKeys } from "../src/opportunitySort";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  isActiveOpportunity,
  isDetailUrl,
  availabilityUntil,
} from "../src/availability";
import { internal } from "./_generated/api";
import { opportunityFields } from "./schema";
const opportunityValidator = v.object({
  _id: v.id("opportunities"),
  _creationTime: v.number(),
  ...opportunityFields,
});
export const list = query({
  args: {
    kind: v.optional(
      v.union(v.literal("hackathon"), v.literal("gig"), v.literal("grant")),
    ),
    search: v.optional(v.string()),
  },
  returns: v.array(opportunityValidator),
  handler: async (ctx, args) => {
    if (args.search?.trim())
      return (
        await ctx.db
          .query("opportunities")
          .withSearchIndex("search_title", (q) => {
            const s = q
              .search("title", args.search!.trim())
              .eq("status", "open");
            return args.kind ? s.eq("kind", args.kind) : s;
          })
          .take(100)
      ).filter((o) => isActiveOpportunity(o));
    return (
      await ctx.db
        .query("opportunities")
        .withIndex("by_validUntil", (q) => q.gt("validUntil", Date.now()))
        .order("desc")
        .take(100)
    ).filter(
      (o) => isActiveOpportunity(o) && (!args.kind || o.kind === args.kind),
    );
  },
});
export const saved = query({
  args: {},
  returns: v.array(v.id("opportunities")),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return (
      await ctx.db
        .query("saved")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(100)
    ).map((x) => x.opportunityId);
  },
});
export const toggleSave = mutation({
  args: { opportunityId: v.id("opportunities") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save opportunities.");
    const target = await ctx.db.get(args.opportunityId);
    if (!target) throw Error("Opportunity not found");
    const canonical = target.canonicalId ?? target._id;
    const saves = await ctx.db
      .query("saved")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100);
    const matching = [];
    for (const save of saves) {
      const source = await ctx.db.get(save.opportunityId);
      if ((source?.canonicalId ?? source?._id) === canonical)
        matching.push(save);
    }
    if (matching.length) {
      for (const save of matching) await ctx.db.delete(save._id);
      return false;
    }
    const opportunity = await ctx.db.get(args.opportunityId);
    if (!opportunity || !isActiveOpportunity(opportunity))
      throw new Error("This opportunity is no longer available.");
    if (
      (
        await ctx.db
          .query("saved")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .take(100)
      ).length >= 100
    )
      throw new Error("Your saved list is full. Remove an item first.");
    await ctx.db.insert("saved", { userId, ...args });
    return true;
  },
});
export const candidates = internalQuery({
  args: {},
  returns: v.array(opportunityValidator),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("opportunities")
        .withIndex("by_kind_and_validUntil", (q) =>
          q.eq("kind", "hackathon").gt("validUntil", Date.now()),
        )
        .take(250)
    ).filter(
      (o) => isActiveOpportunity(o) && !o.canonicalId && o.kind === "hackathon",
    ),
});
export const upsert = internalMutation({
  args: opportunityFields,
  returns: v.id("opportunities"),
  handler: async (ctx, args) => {
    args.url = normalizeSourceUrl(args.url) ?? args.url;
    if (!isDetailUrl(args.url))
      throw new Error("A direct opportunity source is required.");
    if (
      args.identity &&
      normalizeSourceUrl(args.identity.sourceUrl) !== args.url
    )
      throw Error("Identity evidence belongs to a different source");
    const sameUrl = await ctx.db
      .query("opportunities")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .order("desc")
      .take(12);
    const edition =
      args.identity?.edition ?? args.title.match(/\b20\d{2}\b/)?.[0];
    const existing = sameUrl.find(
      (o) =>
        (o.identity?.edition ?? o.title.match(/\b20\d{2}\b/)?.[0]) === edition,
    );
    const fields = {
      ...args,
      identity: existing?.identityReviewHold
        ? undefined
        : (args.identity ?? existing?.identity),
      eventKey: existing?.identityReviewHold
        ? undefined
        : args.identity
          ? (identityKey(args.identity) ?? undefined)
          : existing?.eventKey,
      identityReviewHold: existing?.identityReviewHold,
      deadlineDate: args.deadlineDate,
      ...sortKeys(args),
      cashAmount: args.cashAmount,
      cashCurrency: args.cashCurrency,
      cashStatus: args.cashStatus,
      cashAmountUSD: args.cashAmountUSD,
      cashEvidence: args.cashEvidence,
      cashVerifiedAt: args.cashVerifiedAt,
      validUntil: availabilityUntil(args),
      searchText: [args.title, args.organization, ...args.skills].join(" "),
    };
    let id;
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      id = existing._id;
    } else id = await ctx.db.insert("opportunities", fields);
    await ctx.db.insert("sourceObservations", {
      opportunityId: id,
      facts: fieldEvidence({ ...fields, _id: id }),
      observedAt: args.checkedAt,
    });
    await reconcileIdentity(ctx, id);
    if (
      args.deadline &&
      args.deadline > Date.now() &&
      (!existing ||
        existing.deadline !== args.deadline ||
        existing.status !== "open")
    )
      await ctx.scheduler.runAt(args.deadline, internal.board.expire, {
        id,
        deadline: args.deadline,
      });
    return id;
  },
});
export const expire = internalMutation({
  args: { id: v.id("opportunities"), deadline: v.number() },
  returns: v.null(),
  handler: async (ctx, { id, deadline }) => {
    const o = await ctx.db.get(id);
    if (o?.deadline === deadline && deadline <= Date.now())
      await ctx.db.patch(id, { status: "closed", validUntil: 0 });
    return null;
  },
});

export const disqualify = internalMutation({
  args: { url: v.string() },
  returns: v.null(),
  handler: async (ctx, { url }) => {
    const existing = await ctx.db
      .query("opportunities")
      .withIndex("by_url", (q) => q.eq("url", url))
      .order("desc")
      .first();
    if (existing)
      await ctx.db.patch(existing._id, { status: "closed", validUntil: 0 });
    return null;
  },
});

export const unconfirm = internalMutation({
  args: { url: v.string() },
  returns: v.null(),
  handler: async (ctx, { url }) => {
    const existing = await ctx.db
      .query("opportunities")
      .withIndex("by_url", (q) => q.eq("url", url))
      .order("desc")
      .first();
    if (existing)
      await ctx.db.patch(existing._id, {
        deadlineConfirmed: false,
        validUntil: 0,
      });
    return null;
  },
});

export const page = query({
  args: {
    paginationOpts: paginationOptsValidator,
    asOf: v.number(),
    search: v.optional(v.string()),
    sort: v.optional(
      v.union(
        v.literal("bestFit"),
        v.literal("endingSoon"),
        v.literal("endingLast"),
        v.literal("cash"),
        v.literal("prize"),
        v.literal("newest"),
      ),
    ),
    kind: v.optional(
      v.union(v.literal("hackathon"), v.literal("gig"), v.literal("grant")),
    ),
  },
  returns: paginationResultValidator(opportunityValidator),
  handler: async (ctx, args) => {
    const sort = args.sort ?? "endingSoon";
    const index =
      sort === "prize"
        ? "by_status_prize"
        : sort === "cash"
          ? "by_status_cash"
          : sort === "endingLast"
            ? "by_status_last"
            : "by_status_soon";
    const kindIndex =
      sort === "prize"
        ? "by_status_kind_prize"
        : sort === "cash"
          ? "by_status_kind_cash"
          : sort === "endingLast"
            ? "by_status_kind_last"
            : "by_status_kind_soon";
    const search = args.search?.trim();
    const query = search
      ? ctx.db
          .query("opportunities")
          .withSearchIndex("search_catalog", (q) =>
            q
              .search("searchText", search)
              .eq("status", "open")
              .eq("kind", "hackathon"),
          )
      : sort === "newest"
        ? args.kind
          ? ctx.db
              .query("opportunities")
              .withIndex("by_status_and_kind", (q) =>
                q.eq("status", "open").eq("kind", args.kind!),
              )
              .order("desc")
          : ctx.db
              .query("opportunities")
              .withIndex("by_status_created", (q) => q.eq("status", "open"))
              .order("desc")
        : args.kind
          ? ctx.db
              .query("opportunities")
              .withIndex(kindIndex, (q) =>
                q.eq("status", "open").eq("kind", args.kind!),
              )
          : ctx.db
              .query("opportunities")
              .withIndex(index, (q) => q.eq("status", "open"));
    // Stable snapshot bounds keep Convex cursors valid across page requests.
    // Revalidate against server time below: asOf is not a freshness authority.
    const snapshot = args.asOf;
    const result = await query
      .filter((q) =>
        q.and(
          q.eq(q.field("kind"), "hackathon"),
          q.eq(q.field("origin"), "source"),
          q.eq(q.field("canonicalId"), undefined),
          q.eq(q.field("acceptingSubmissions"), true),
          q.eq(q.field("deadlineConfirmed"), true),
          q.gt(q.field("deadline"), snapshot),
          q.gte(q.field("checkedAt"), snapshot - 48 * 3600000),
        ),
      )
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.filter((o) => isActiveOpportunity(o, Date.now())),
    };
  },
});

/** Public catalog health, bounded and labelled when the inventory exceeds the scan. */
export const coverage = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const records = await ctx.db
      .query("opportunities")
      .withIndex("by_status_and_kind", (q) =>
        q.eq("status", "open").eq("kind", "hackathon"),
      )
      .take(1001);
    const scanned = records
      .slice(0, 1000)
      .filter((o) => !o.canonicalId && o.origin === "source");
    const active = scanned.filter((o) => isActiveOpportunity(o, now));
    const pending = scanned.filter(
      (o) =>
        !isActiveOpportunity(o, now) &&
        (o.deadline === null || o.deadline > now),
    );
    return {
      active: active.length,
      remote: active.filter((o) => o.remote).length,
      closingWeek: active.filter((o) => o.deadline! <= now + 7 * 86400000)
        .length,
      limited: records.length > 1000,
      pending: pending.length,
      pendingExamples: pending.slice(0, 8).map((o) => ({
        title: o.title,
        url: o.url,
        reason:
          !o.deadlineConfirmed || o.deadline === null
            ? "Closing date needs confirmation"
            : !o.acceptingSubmissions
              ? "Submission window needs confirmation"
              : "Source check is older than 48 hours",
      })),
    };
  },
});
export const backfillAvailability = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    updated: v.number(),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("opportunities")
      .paginate({ cursor: args.cursor, numItems: 100 });
    for (const o of batch.page)
      await ctx.db.patch(o._id, {
        ...sortKeys(o),
        validUntil: availabilityUntil(o),
        searchText: [o.title, o.organization, ...o.skills].join(" "),
      });
    return {
      updated: batch.page.length,
      isDone: batch.isDone,
      continueCursor: batch.continueCursor,
    };
  },
});

export const savedData = query({
  args: {},
  returns: v.object({
    ids: v.array(v.id("opportunities")),
    records: v.array(opportunityValidator),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ids: [], records: [] };
    const saved = await ctx.db
      .query("saved")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(100);
    const records = await Promise.all(
      saved.map(async (s) => {
        const o = await ctx.db.get(s.opportunityId);
        return o ? resolveRecord(ctx, o) : null;
      }),
    );
    return {
      ids: [
        ...new Set([
          ...saved.map((s) => s.opportunityId),
          ...records.flatMap((o) => (o ? [o._id] : [])),
        ]),
      ],
      records: records
        .filter((o, i, a) => o && a.findIndex((x) => x?._id === o._id) === i)
        .flatMap((o) => (o && isActiveOpportunity(o) ? [o] : [])),
    };
  },
});

/** Operator-only, bounded prize backfill; does not alter source freshness or deadlines. */
export const updatePrizes = internalMutation({
  args: {
    records: v.array(
      v.object({
        url: v.string(),
        reward: v.optional(v.string()),
        cashAmount: v.optional(v.number()),
        cashCurrency: v.optional(v.string()),
        cashStatus: v.optional(
          v.union(
            v.literal("confirmed"),
            v.literal("nonCash"),
            v.literal("unpublished"),
            v.literal("ambiguous"),
          ),
        ),
        cashAmountUSD: v.optional(v.number()),
        cashEvidence: v.optional(v.string()),
        cashVerifiedAt: v.optional(v.number()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { records }) => {
    if (records.length > 50) throw new Error("Maximum 50 records per batch");
    let updated = 0;
    for (const { url, ...cash } of records) {
      const item = await ctx.db
        .query("opportunities")
        .withIndex("by_url", (q) => q.eq("url", url))
        .order("desc")
        .first();
      if (!item) continue;
      const fields = {
        ...(cash.reward !== undefined ? { reward: cash.reward } : {}),
        cashAmount: cash.cashAmount,
        cashCurrency: cash.cashCurrency,
        cashStatus: cash.cashStatus,
        cashAmountUSD: cash.cashAmountUSD,
        cashEvidence: cash.cashEvidence,
        cashVerifiedAt: cash.cashVerifiedAt,
      };
      if (
        fields.cashAmount !== undefined &&
        (!Number.isFinite(fields.cashAmount) ||
          fields.cashAmount <= 0 ||
          !fields.cashCurrency ||
          !fields.cashEvidence ||
          !fields.cashVerifiedAt ||
          fields.cashStatus !== "confirmed")
      )
        throw new Error("Incomplete prize evidence");
      await ctx.db.patch(item._id, {
        ...fields,
        ...sortKeys({ ...item, ...fields }),
      });
      updated++;
    }
    return updated;
  },
});

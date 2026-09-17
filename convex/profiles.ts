import { isActiveOpportunity } from "../src/availability";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
export const profileFields = {
  userId: v.id("users"),
  skills: v.array(v.string()),
  location: v.string(),
  hours: v.number(),
  solo: v.boolean(),
  goal: v.union(v.literal("learn"), v.literal("earn"), v.literal("portfolio")),
  email: v.string(),
  digestEnabled: v.boolean(),
  nextDigestAt: v.number(),
  threadId: v.optional(v.string()),
};
const profileValidator = v.object({
  _id: v.id("profiles"),
  _creationTime: v.number(),
  ...profileFields,
});
export const mine = query({
  args: {},
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId
      ? await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique()
      : null;
  },
});
export const save = mutation({
  args: {
    skills: v.array(v.string()),
    location: v.string(),
    hours: v.number(),
    solo: v.boolean(),
    goal: v.union(
      v.literal("learn"),
      v.literal("earn"),
      v.literal("portfolio"),
    ),
    digestEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save your profile.");
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("Your account needs an email address.");
    if (!Number.isFinite(args.hours) || args.hours < 1 || args.hours > 80)
      throw new Error("Choose between 1 and 80 hours.");
    if (
      args.skills.length > 20 ||
      args.skills.some((s) => s.length > 60) ||
      args.location.length > 100
    )
      throw new Error("Please shorten your profile.");
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const fields = {
      ...args,
      skills: [...new Set(args.skills.map((s) => s.trim()).filter(Boolean))],
      userId,
      email: user.email.toLowerCase(),
      nextDigestAt: existing?.nextDigestAt ?? Date.now() + 7 * 86400000,
    };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("profiles", fields);
    return null;
  },
});
export const get = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, args) =>
    await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique(),
});
export const setThread = internalMutation({
  args: { userId: v.id("users"), threadId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (p) await ctx.db.patch(p._id, { threadId: args.threadId });
    return null;
  },
});
export const latest = query({
  args: {},
  returns: v.union(
    v.object({ body: v.string(), createdAt: v.number(), request: v.string() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("shortlists")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    if (row) {
      for (const id of row.opportunityIds.slice(0, 3)) {
        const opportunity = await ctx.db.get(id);
        if (!opportunity || !isActiveOpportunity(opportunity)) return null;
      }
    }
    return row
      ? { body: row.body, createdAt: row.createdAt, request: row.request }
      : null;
  },
});

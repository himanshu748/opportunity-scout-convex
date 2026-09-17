import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { hasAiConfiguration } from "../src/aiRouting";
export const status = query({
  args: {},
  returns: v.object({
    ai: v.boolean(),
    firecrawl: v.boolean(),
    email: v.boolean(),
  }),
  handler: async () => ({
    ai: hasAiConfiguration(process.env) && !!process.env.CONVEX_ADMIN_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    email:
      !!process.env.AGENTMAIL_API_KEY &&
      !!process.env.AGENTMAIL_INBOX_ID &&
      (!!process.env.AGENTMAIL_WEBHOOK_SECRET ||
        process.env.SCOUT_EMAIL_POLLING === "true") &&
      process.env.SCOUT_EMAIL_ENABLED === "true",
  }),
});
export const begin = internalMutation({
  args: { kind: v.string() },
  returns: v.id("runs"),
  handler: async (ctx, { kind }) =>
    await ctx.db.insert("runs", {
      kind,
      status: "running",
      message: "",
      startedAt: Date.now(),
    }),
});
export const finish = internalMutation({
  args: { id: v.id("runs"), ok: v.boolean(), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.ok ? "done" : "failed",
      message: args.message,
      finishedAt: Date.now(),
    });
    return null;
  },
});
export const claimAi = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("aiLimits")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (row && Date.now() - row.lastAt < 30000)
      throw new Error("Give Scout a moment. Try again in 30 seconds.");
    if (row) await ctx.db.patch(row._id, { lastAt: Date.now() });
    else await ctx.db.insert("aiLimits", { userId, lastAt: Date.now() });
    return null;
  },
});

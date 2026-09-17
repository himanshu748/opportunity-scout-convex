import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
export const store = internalMutation({
  args: {
    userId: v.id("users"),
    body: v.string(),
    request: v.string(),
    opportunityIds: v.array(v.id("opportunities")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("shortlists", { ...args, createdAt: Date.now() });
    return null;
  },
});

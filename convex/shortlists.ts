import { checksValidator, validateDecision } from "./decision";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
export const store = internalMutation({
  args: {
    userId: v.id("users"),
    body: v.string(),
    checks: checksValidator,
    profileKey: v.string(),
    request: v.string(),
    opportunityIds: v.array(v.id("opportunities")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      !(await validateDecision(ctx, args.userId, args.checks, args.profileKey))
    )
      throw Error("Decision changed before persistence");
    await ctx.db.insert("shortlists", { ...args, createdAt: Date.now() });
    return null;
  },
});

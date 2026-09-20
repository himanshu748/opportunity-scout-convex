import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { decisionFingerprint } from "../src/eventIdentity";
import { recommendationCheck } from "../src/recommendationPolicy";
import { profileKey } from "../src/deliveryPolicy";
export const checksValidator = v.array(
  v.object({ id: v.id("opportunities"), fingerprint: v.string() }),
);
export const packetValidator = v.object({
  body: v.string(),
  checks: checksValidator,
  profileKey: v.string(),
});
export type Packet = {
  body: string;
  checks: { id: Id<"opportunities">; fingerprint: string }[];
  profileKey: string;
};
export async function validateDecision(
  ctx: Pick<QueryCtx, "db">,
  userId: Id<"users">,
  checks: Packet["checks"],
  key: string,
) {
  if (checks.length > 3) return false;
  const p = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!p || profileKey(p) !== key) return false;
  for (const check of checks) {
    const o = await ctx.db.get(check.id);
    if (
      !o ||
      !recommendationCheck(o, p).eligible ||
      decisionFingerprint(o) !== check.fingerprint
    )
      return false;
  }
  return true;
}
export const validate = internalQuery({
  args: {
    userId: v.id("users"),
    checks: checksValidator,
    profileKey: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) =>
    validateDecision(ctx, args.userId, args.checks, args.profileKey),
});

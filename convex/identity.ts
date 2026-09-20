import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { conflictsFor, fieldEvidence, identityKey } from "../src/eventIdentity";
export async function reconcileIdentity(
  ctx: MutationCtx,
  id: Id<"opportunities">,
) {
  const item = await ctx.db.get(id);
  if (!item) return;
  const key = item.identity ? identityKey(item.identity) : null;
  if (!key) return;
  const peers = await ctx.db
    .query("opportunities")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", key))
    .take(13);
  if (peers.length > 12) throw new Error("Identity group exceeds review limit");
  const ordered = peers.sort(
    (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id),
  );
  const canonical = ordered[0];
  if (!canonical) return;
  for (const peer of ordered) {
    const target = peer._id === canonical._id ? undefined : canonical._id;
    if (peer.canonicalId !== target && target)
      await ctx.db.insert("identityChanges", {
        opportunityId: peer._id,
        previousCanonicalId: peer.canonicalId,
        canonicalId: target,
        reason: key,
        createdAt: Date.now(),
      });
    await ctx.db.patch(peer._id, { canonicalId: target });
  }
  await ctx.db.patch(canonical._id, {
    conflicts: conflictsFor(ordered),
    sourceAliases: ordered.map((o) => o.url),
    fieldEvidence: ordered.flatMap(fieldEvidence),
  });
}
export async function resolveRecord(
  ctx: { db: MutationCtx["db"] | import("./_generated/server").QueryCtx["db"] },
  row: Doc<"opportunities">,
) {
  return row.canonicalId ? ((await ctx.db.get(row.canonicalId)) ?? row) : row;
}
/** Reversible pointer migration: saved and shortlist IDs are never rewritten/deleted. */
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    updated: v.number(),
    cursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("opportunities")
      .paginate({ cursor: args.cursor, numItems: 25 });
    let updated = 0;
    for (const o of batch.page) {
      const key = o.identity ? identityKey(o.identity) : null;
      if (!key) continue;
      await ctx.db.patch(o._id, { eventKey: key });
      await reconcileIdentity(ctx, o._id);
      updated++;
    }
    return { updated, cursor: batch.continueCursor, isDone: batch.isDone };
  },
});
export const rollback = internalMutation({
  args: { changeId: v.id("identityChanges") },
  returns: v.null(),
  handler: async (ctx, { changeId }) => {
    const change = await ctx.db.get(changeId);
    if (!change || change.revertedAt) return null;
    const item = await ctx.db.get(change.opportunityId);
    if (!item || item.canonicalId !== change.canonicalId)
      throw Error("Identity changed since migration; review required");
    // Retire the grouping key so future automatic upserts do not reapply this merge.
    await ctx.db.patch(item._id, {
      canonicalId: change.previousCanonicalId,
      eventKey: undefined,
      identity: undefined,
      identityReviewHold: true,
    });
    await ctx.db.patch(change._id, { revertedAt: Date.now() });
    await reconcileIdentity(ctx, change.canonicalId);
    return null;
  },
});

import { formatScoutEmail } from "../src/emailFormatting";
import { readScoutThread } from "../src/scoutMailbox";
import { emailEnabled, digestReply } from "../src/emailPolicy";
import {
  WEEK,
  LEASE,
  canClaim,
  digestPeriod,
  retryPlan,
  profileKey,
} from "../src/deliveryPolicy";
import { v } from "convex/values";
import { createFunctionHandle } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { AgentMail, type OutboundId } from "@agentmail/convex";
import {
  internalMutation,
  internalAction,
  internalQuery,
  query,
  type MutationCtx,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { packetValidator, validateDecision } from "./decision";
export const mail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.email.received,
  retryAttempts: 3,
  initialBackoffMs: 60000,
});
const enabled = () => emailEnabled(process.env.SCOUT_EMAIL_ENABLED);
const getProfile = (ctx: Pick<MutationCtx, "db">, userId: Id<"users">) =>
  ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
const getDelivery = (
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  period: string,
) =>
  ctx.db
    .query("deliveries")
    .withIndex("by_userId_and_period", (q) =>
      q.eq("userId", userId).eq("period", period),
    )
    .unique();
const getReply = (ctx: Pick<MutationCtx, "db">, messageId: string) =>
  ctx.db
    .query("replyEvents")
    .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
    .unique();
export const due = internalQuery({
  args: {},
  returns: v.array(v.id("users")),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("profiles")
        .withIndex("by_digestEnabled_and_nextDigestAt", (q) =>
          q.eq("digestEnabled", true).lte("nextDigestAt", Date.now()),
        )
        .take(25)
    ).map((p) => p.userId),
});
export const schedule = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!enabled()) return null;
    const now = Date.now();
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_digestEnabled_and_nextDigestAt", (q) =>
        q.eq("digestEnabled", true).lte("nextDigestAt", now),
      )
      .take(25);
    for (const p of profiles) {
      const period = digestPeriod(p.nextDigestAt);
      if (!(await getDelivery(ctx, p.userId, period))) {
        await ctx.db.insert("deliveries", {
          userId: p.userId,
          period,
          status: "queued",
          attempts: 0,
          retryAt: now,
          periodEnd: now + WEEK,
          profileKey: profileKey(p),
        });
        await ctx.scheduler.runAfter(0, internal.email.compose, {
          userId: p.userId,
          period,
        });
      }
      await ctx.db.patch(p._id, { nextDigestAt: now + WEEK });
    }
    return null;
  },
});
export const claim = internalMutation({
  args: { userId: v.id("users"), period: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const row = await getDelivery(ctx, args.userId, args.period),
      p = await getProfile(ctx, args.userId),
      now = Date.now();
    if (!row || !canClaim(row, now)) return null;
    if (!enabled() || !p?.digestEnabled || row.profileKey !== profileKey(p)) {
      await ctx.db.patch(row._id, {
        status: "cancelled",
        retryAt: undefined,
        message:
          "Consent or preferences changed; no queued send will be attempted",
      });
      return null;
    }
    const attempt = (row.attempts ?? 0) + 1;
    await ctx.db.patch(row._id, {
      status: "composing",
      attempts: attempt,
      leaseUntil: now + LEASE,
      retryAt: now + LEASE,
    });
    return attempt;
  },
});
export const compose = internalAction({
  args: { userId: v.id("users"), period: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.runMutation(internal.email.claim, args);
    if (attempt === null) return null;
    try {
      const packet = await ctx.runAction(internal.advisor.generate, {
        userId: args.userId,
        prompt:
          "Build my weekly shortlist with up to three current hackathons, fit, unknowns and a next step for each.",
      });
      await ctx.runMutation(internal.email.enqueue, {
        ...args,
        attempt,
        packet,
      });
    } catch {
      await ctx.runMutation(internal.email.failed, { ...args, attempt });
    }
    return null;
  },
});
export const failed = internalMutation({
  args: {
    userId: v.id("users"),
    period: v.string(),
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getDelivery(ctx, args.userId, args.period);
    if (
      row &&
      !row.outboundId &&
      row.status === "composing" &&
      row.attempts === args.attempt
    )
      await ctx.db.patch(row._id, {
        ...retryPlan(row.attempts ?? 1, row.periodEnd ?? 0, Date.now()),
        leaseUntil: undefined,
        message:
          "Generation or evidence validation failed; bounded retry scheduled when eligible.",
      });
    return null;
  },
});
export const enqueue = internalMutation({
  args: {
    userId: v.id("users"),
    period: v.string(),
    attempt: v.number(),
    packet: packetValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await getProfile(ctx, args.userId),
      row = await getDelivery(ctx, args.userId, args.period);
    if (
      !row ||
      row.outboundId ||
      row.status !== "composing" ||
      row.attempts !== args.attempt
    )
      return null;
    if (!enabled() || !p?.digestEnabled || row.profileKey !== profileKey(p)) {
      await ctx.db.patch(row._id, {
        status: "cancelled",
        retryAt: undefined,
        message:
          "Consent or preferences changed; no queued send will be attempted",
      });
      return null;
    }
    if (
      !(await validateDecision(
        ctx,
        args.userId,
        args.packet.checks,
        args.packet.profileKey,
      ))
    )
      throw Error("Decision changed before delivery");
    const outboundId = await mail.sendMessage(
      ctx,
      process.env.AGENTMAIL_INBOX_ID!,
      {
        to: p.email,
        subject: "Your hackathon shortlist",
        ...formatScoutEmail(args.packet.body),
        labels: ["scout-digest"],
        headers: {
          "X-Scout-Guard": await createFunctionHandle(internal.email.sendGuard),
        },
      },
    );
    await ctx.db.patch(row._id, {
      ...args.packet,
      outboundId,
      status: "queued",
      leaseUntil: undefined,
      retryAt: Date.now() + 60000,
    });
    return null;
  },
});
/** Checked by the component immediately before EACH provider attempt, not only enqueue. */
export const sendGuard = internalQuery({
  args: { outboundId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { outboundId }) => {
    if (!enabled()) return false;
    const d = await ctx.db
      .query("deliveries")
      .withIndex("by_outboundId", (q) => q.eq("outboundId", outboundId))
      .unique();
    const r = d
      ? null
      : await ctx.db
          .query("replyEvents")
          .withIndex("by_outboundId", (q) => q.eq("outboundId", outboundId))
          .unique();
    const row = d ?? r;
    if (
      !row?.userId ||
      !row.checks ||
      !row.profileKey ||
      row.status !== "queued" ||
      (row.periodEnd ?? 0) <= Date.now()
    )
      return false;
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", row.userId!))
      .unique();
    return (
      !!p?.digestEnabled &&
      (await validateDecision(ctx, row.userId, row.checks, row.profileKey))
    );
  },
});
export async function cancelPending(ctx: MutationCtx, userId: Id<"users">) {
  // Provider sends have their own guard, so old rows beyond these bounded cleanup batches cannot send either.
  const ds = await ctx.db
    .query("deliveries")
    .withIndex("by_userId_and_period", (q) => q.eq("userId", userId))
    .order("desc")
    .take(25);
  const rs = await ctx.db
    .query("replyEvents")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .order("desc")
    .take(25);
  for (const row of [...ds, ...rs]) {
    if (row.status === "sent" || row.status === "cancelled") continue;
    if (row.outboundId) {
      const state = await mail.status(ctx, row.outboundId as OutboundId);
      if (state && ["sent", "delivered"].includes(state.status)) {
        await ctx.db.patch(row._id, {
          status: "sent",
          retryAt: undefined,
          leaseUntil: undefined,
          message: "Provider already accepted delivery; cannot recall",
        });
        continue;
      }
      if (state?.status === "pending")
        await mail.cancel(ctx, row.outboundId as OutboundId);
    }
    await ctx.db.patch(row._id, {
      status: "cancelled",
      retryAt: undefined,
      leaseUntil: undefined,
    });
  }
}
export const received = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, { message }) => {
    const reply = digestReply(message, process.env.AGENTMAIL_INBOX_ID);
    if (!reply) return null;
    // STOP is allowed even while provider/AI sending is disabled.
    if (!enabled() && !reply.unsubscribe) return null;
    const owners = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", reply.sender))
      .take(2);
    if (owners.length !== 1) return null;
    const p = owners[0];
    if (!p.digestEnabled) return null;
    const ds = await ctx.db
      .query("deliveries")
      .withIndex("by_userId_and_period", (q) => q.eq("userId", p.userId))
      .order("desc")
      .take(10);
    let belongs = false;
    for (const d of ds) {
      if (!d.outboundId) continue;
      const s = await mail.status(ctx, d.outboundId as OutboundId);
      if (s && s.threadId === message.thread_id && s.agentmailMessageId) {
        const parent = message.in_reply_to;
        if (
          parent === s.agentmailMessageId ||
          (Array.isArray(message.references) &&
            message.references.includes(s.agentmailMessageId))
        )
          belongs = true;
      }
    }
    if (!belongs) return null;
    const prior = await getReply(ctx, message.message_id);
    if (reply.unsubscribe) {
      await ctx.db.patch(p._id, {
        digestEnabled: false,
        consentVersion: (p.consentVersion ?? 0) + 1,
      });
      await cancelPending(ctx, p.userId);
      if (!prior)
        await ctx.db.insert("replyEvents", {
          messageId: message.message_id,
          userId: p.userId,
          status: "cancelled",
        });
      return null;
    }
    if (prior) return null; // Existing retryable work is recovered by the durable worker.
    await ctx.db.insert("replyEvents", {
      messageId: message.message_id,
      userId: p.userId,
      inboxId: message.inbox_id,
      threadId: message.thread_id,
      sender: reply.sender,
      text: reply.text,
      status: "queued",
      attempts: 0,
      retryAt: Date.now(),
      periodEnd: Date.now() + 24 * 3600000,
      profileKey: profileKey(p),
    });
    await ctx.scheduler.runAfter(0, internal.email.respond, {
      userId: p.userId,
      messageId: message.message_id,
      text: reply.text,
    });
    return null;
  },
});
export const claimReply = internalMutation({
  args: { userId: v.id("users"), messageId: v.string() },
  returns: v.union(
    v.object({ attempt: v.number(), text: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await getReply(ctx, args.messageId),
      p = await getProfile(ctx, args.userId),
      now = Date.now();
    if (!row || row.userId !== args.userId || !row.text || !canClaim(row, now))
      return null;
    if (!enabled() || !p?.digestEnabled || row.profileKey !== profileKey(p)) {
      await ctx.db.patch(row._id, {
        status: "cancelled",
        retryAt: undefined,
        message:
          "Consent or preferences changed; no queued send will be attempted",
      });
      return null;
    }
    const attempt = (row.attempts ?? 0) + 1;
    await ctx.db.patch(row._id, {
      attempts: attempt,
      status: "composing",
      leaseUntil: now + LEASE,
      retryAt: now + LEASE,
    });
    return { attempt, text: row.text };
  },
});
export const respond = internalAction({
  args: { userId: v.id("users"), messageId: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internal.email.claimReply, {
      userId: args.userId,
      messageId: args.messageId,
    });
    if (!claimed) return null;
    try {
      await ctx.runMutation(internal.system.claimAi, { userId: args.userId });
      const packet = await ctx.runAction(internal.advisor.generate, {
        userId: args.userId,
        prompt: claimed.text,
      });
      await ctx.runMutation(internal.email.reply, {
        userId: args.userId,
        messageId: args.messageId,
        attempt: claimed.attempt,
        packet,
      });
    } catch {
      await ctx.runMutation(internal.email.replyFailed, {
        messageId: args.messageId,
        attempt: claimed.attempt,
      });
    }
    return null;
  },
});
export const replyFailed = internalMutation({
  args: { messageId: v.string(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await getReply(ctx, args.messageId);
    if (
      row &&
      !row.outboundId &&
      row.status === "composing" &&
      row.attempts === args.attempt
    )
      await ctx.db.patch(row._id, {
        ...retryPlan(row.attempts ?? 1, row.periodEnd ?? 0, Date.now()),
        leaseUntil: undefined,
        message: "Refinement failed; retry scheduled when eligible.",
      });
    return null;
  },
});
export const reply = internalMutation({
  args: {
    userId: v.id("users"),
    messageId: v.string(),
    attempt: v.number(),
    packet: packetValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await getProfile(ctx, args.userId),
      row = await getReply(ctx, args.messageId);
    if (
      !row ||
      row.userId !== args.userId ||
      row.status !== "composing" ||
      row.outboundId ||
      row.attempts !== args.attempt
    )
      return null;
    if (!enabled() || !p?.digestEnabled || row.profileKey !== profileKey(p)) {
      await ctx.db.patch(row._id, {
        status: "cancelled",
        retryAt: undefined,
        message:
          "Consent or preferences changed; no queued send will be attempted",
      });
      return null;
    }
    if (
      !row.inboxId ||
      row.inboxId !== process.env.AGENTMAIL_INBOX_ID ||
      row.sender !== p.email ||
      !(await validateDecision(
        ctx,
        args.userId,
        args.packet.checks,
        args.packet.profileKey,
      ))
    )
      throw Error("Reply no longer authorized or current");
    const outboundId = await mail.replyToMessage(
      ctx,
      row.inboxId,
      args.messageId,
      {
        ...formatScoutEmail(args.packet.body, true),
        headers: {
          "X-Scout-Guard": await createFunctionHandle(internal.email.sendGuard),
        },
      },
    );
    await ctx.db.patch(row._id, {
      ...args.packet,
      outboundId,
      status: "queued",
      leaseUntil: undefined,
      retryAt: Date.now() + 60000,
    });
    return null;
  },
});
/** Recovery is indexed by work due time, independent of profiles.nextDigestAt. */
export const recover = internalMutation({
  args: {},
  returns: v.object({ examined: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const ds = await ctx.db
      .query("deliveries")
      .withIndex("by_retryAt", (q) => q.gt("retryAt", 0).lte("retryAt", now))
      .take(25);
    const rs = await ctx.db
      .query("replyEvents")
      .withIndex("by_retryAt", (q) => q.gt("retryAt", 0).lte("retryAt", now))
      .take(25);
    for (const row of [...ds, ...rs]) {
      const receipt = row.outboundId
        ? await mail.status(ctx, row.outboundId as OutboundId)
        : null;
      if (receipt && ["sent", "delivered"].includes(receipt.status)) {
        await ctx.db.patch(row._id, {
          status: "sent",
          retryAt: undefined,
          leaseUntil: undefined,
          message: "Provider accepted delivery",
        });
        continue;
      }
      // Conservatively bound retries from the job's creation, before the provider key expires.
      if (row.outboundId && now - row._creationTime >= 23 * 3600000) {
        if (receipt?.status === "pending")
          await mail.cancel(ctx, row.outboundId as OutboundId);
        await ctx.db.patch(row._id, {
          status: "failed",
          retryAt: undefined,
          leaseUntil: undefined,
          message:
            "Send recovery window ended; inspect provider receipt before any manual retry",
        });
        continue;
      }
      const p = row.userId ? await getProfile(ctx, row.userId) : null;
      if (
        !p?.digestEnabled ||
        (row.periodEnd ?? 0) <= now ||
        row.profileKey !== profileKey(p) ||
        (row.outboundId &&
          (!row.checks ||
            !(await validateDecision(
              ctx,
              row.userId!,
              row.checks,
              row.profileKey!,
            ))))
      ) {
        if (row.outboundId) {
          if (receipt?.status === "pending")
            await mail.cancel(ctx, row.outboundId as OutboundId);
        }
        await ctx.db.patch(row._id, {
          status: "cancelled",
          retryAt: undefined,
        });
        continue;
      }
      if (row.outboundId) {
        const sent = receipt && ["sent", "delivered"].includes(receipt.status);
        const pending = receipt?.status === "pending";
        await ctx.db.patch(row._id, {
          status: sent ? "sent" : pending ? "queued" : "failed",
          retryAt: pending ? now + 60000 : undefined,
          message: pending
            ? "Provider retry pending"
            : sent
              ? "Provider accepted delivery"
              : "Provider failed; inspect receipt before any manual retry",
        });
        continue;
      }
      if (!enabled()) continue;
      if ((row.attempts ?? 0) >= 3) {
        await ctx.db.patch(row._id, {
          status: "failed",
          retryAt: undefined,
          message: "Recovery attempts exhausted",
        });
        continue;
      }
      if ((row.leaseUntil ?? 0) > now) continue;
      await ctx.db.patch(row._id, { retryAt: now + LEASE });
      if ("period" in row)
        await ctx.scheduler.runAfter(0, internal.email.compose, {
          userId: row.userId,
          period: row.period,
        });
      else if (row.userId && row.text)
        await ctx.scheduler.runAfter(0, internal.email.respond, {
          userId: row.userId,
          messageId: row.messageId,
          text: row.text,
        });
    }
    return { examined: ds.length + rs.length };
  },
});
export const myDelivery = query({
  args: {},
  returns: v.union(
    v.object({
      status: v.string(),
      period: v.string(),
      message: v.string(),
      attempts: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("deliveries")
      .withIndex("by_userId_and_period", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return row
      ? {
          status: row.status,
          period: row.period,
          message: row.message ?? "",
          attempts: row.attempts ?? 0,
        }
      : null;
  },
});

/** Only return threads created by Scout for currently opted-in users. */
export const pollTargets = internalQuery({
  args: { cursor: v.optional(v.string()) },
  returns: v.object({
    threads: v.array(v.string()),
    cursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("deliveries")
      .withIndex("by_creation_time", (q) =>
        q.gt("_creationTime", Date.now() - 30 * 86400000),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: 25 });
    const deliveries = batch.page;
    const threads = new Set<string>();
    for (const delivery of deliveries) {
      if (!delivery.outboundId) continue;
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", delivery.userId))
        .unique();
      if (!profile?.digestEnabled) continue;
      const status = await mail.status(
        ctx,
        delivery.outboundId as Parameters<typeof mail.status>[1],
      );
      if (status?.threadId) threads.add(status.threadId);
    }
    return {
      threads: [...threads],
      cursor: batch.continueCursor,
      isDone: batch.isDone,
    };
  },
});
export const pollReplies = internalAction({
  args: { cursor: v.optional(v.string()), pages: v.optional(v.number()) },
  returns: v.object({ checked: v.number(), failed: v.number() }),
  handler: async (ctx, args): Promise<{ checked: number; failed: number }> => {
    if (process.env.SCOUT_EMAIL_POLLING !== "true")
      return { checked: 0, failed: 0 };
    const batch = await ctx.runQuery(internal.email.pollTargets, {
      cursor:
        args.cursor ??
        (await ctx.runQuery(internal.email.pollCursor, {})) ??
        undefined,
    });
    const threads = batch.threads;
    let checked = 0,
      failed = 0;
    for (const threadId of threads) {
      try {
        const messages = await readScoutThread(
          process.env.AGENTMAIL_INBOX_ID!,
          threadId,
          process.env.AGENTMAIL_API_KEY!,
        );
        for (const message of messages) {
          await ctx.runMutation(internal.email.received, {
            message,
            thread: { thread_id: threadId },
            eventId: `poll:${message.message_id}`,
          });
        }
        checked++;
      } catch (error) {
        console.error(
          "Scout thread polling failed",
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown provider error",
        );
        failed++;
      }
    }
    await ctx.runMutation(internal.email.savePollCursor, {
      cursor: batch.isDone ? null : batch.cursor,
    });
    if (!batch.isDone && (args.pages ?? 0) < 3)
      await ctx.scheduler.runAfter(1000, internal.email.pollReplies, {
        cursor: batch.cursor,
        pages: (args.pages ?? 0) + 1,
      });
    return { checked, failed };
  },
});

export const pollCursor = internalQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("emailWorker")
        .withIndex("by_name", (q) => q.eq("name", "reply-poll"))
        .unique()
    )?.cursor ?? null,
});
export const savePollCursor = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("emailWorker")
      .withIndex("by_name", (q) => q.eq("name", "reply-poll"))
      .unique();
    if (row) await ctx.db.patch(row._id, args);
    else await ctx.db.insert("emailWorker", { name: "reply-poll", ...args });
    return null;
  },
});
/** Optional operator migration. Run while sending is paused, inspect each batch. */
export const migrateDeliveries = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    cursor: v.string(),
    isDone: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("deliveries")
      .paginate({ cursor: args.cursor, numItems: 25 });
    let updated = 0;
    for (const row of batch.page) {
      if (row.periodEnd !== undefined) continue;
      const p = await getProfile(ctx, row.userId);
      const periodEnd = row._creationTime + WEEK;
      const recoverable =
        !row.outboundId &&
        p?.digestEnabled &&
        periodEnd > Date.now() &&
        row.status !== "sent";
      await ctx.db.patch(row._id, {
        periodEnd,
        profileKey: p ? profileKey(p) : undefined,
        attempts: 0,
        status: recoverable
          ? "retryable"
          : row.outboundId
            ? row.status
            : "failed",
        retryAt: recoverable
          ? Date.now()
          : row.outboundId
            ? Date.now()
            : undefined,
        message: recoverable
          ? "Legacy generation queued for bounded recovery"
          : "Legacy record preserved; provider receipt needs inspection",
      });
      updated++;
    }
    return { cursor: batch.continueCursor, isDone: batch.isDone, updated };
  },
});

export const myReply = query({
  args: {},
  returns: v.union(
    v.object({ status: v.string(), message: v.string(), attempts: v.number() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("replyEvents")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return row
      ? {
          status: row.status ?? "legacy",
          message: row.message ?? "",
          attempts: row.attempts ?? 0,
        }
      : null;
  },
});

/** Operator-triggered normal digest, only for an already opted-in owner. */
export const requestCurrentDigest = internalMutation({
  args: { userId: v.id("users") },
  returns: v.string(),
  handler: async (ctx, { userId }) => {
    const p = await getProfile(ctx, userId);
    if (!enabled() || !p?.digestEnabled)
      throw Error("An opted-in profile and enabled sending are required");
    const now = Date.now(),
      period = digestPeriod(now);
    if (!(await getDelivery(ctx, userId, period))) {
      await ctx.db.insert("deliveries", {
        userId,
        period,
        status: "queued",
        attempts: 0,
        retryAt: now,
        periodEnd: now + WEEK,
        profileKey: profileKey(p),
      });
      await ctx.scheduler.runAfter(0, internal.email.compose, {
        userId,
        period,
      });
      await ctx.db.patch(p._id, { nextDigestAt: now + WEEK });
    }
    return period;
  },
});

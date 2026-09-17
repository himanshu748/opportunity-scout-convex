import { emailEnabled, digestReply } from "../src/emailPolicy";
import { v } from "convex/values";
import { AgentMail } from "@agentmail/convex";
import {
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
export const mail = new AgentMail(components.agentmail, {
  onMessageReceived: internal.email.received,
});
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
    if (!emailEnabled(process.env.SCOUT_EMAIL_ENABLED)) return null;
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_digestEnabled_and_nextDigestAt", (q) =>
        q.eq("digestEnabled", true).lte("nextDigestAt", Date.now()),
      )
      .take(25);
    for (const p of profiles) {
      const period = String(Math.floor(p.nextDigestAt / (7 * 86400000)));
      const existing = await ctx.db
        .query("deliveries")
        .withIndex("by_userId_and_period", (q) =>
          q.eq("userId", p.userId).eq("period", period),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("deliveries", {
          userId: p.userId,
          period,
          status: "queued",
        });
        await ctx.scheduler.runAfter(0, internal.email.compose, {
          userId: p.userId,
          period,
        });
      }
      await ctx.db.patch(p._id, { nextDigestAt: Date.now() + 7 * 86400000 });
    }
    return null;
  },
});
export const compose = internalAction({
  args: { userId: v.id("users"), period: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const body = await ctx.runAction(internal.advisor.generate, {
        userId: args.userId,
        prompt:
          "Build my weekly shortlist with up to three current opportunities, fit, unknowns and a next step for each.",
      });
      await ctx.runMutation(internal.email.enqueue, { ...args, body });
    } catch {
      await ctx.runMutation(internal.email.failed, args);
    }
    return null;
  },
});
export const failed = internalMutation({
  args: { userId: v.id("users"), period: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("deliveries")
      .withIndex("by_userId_and_period", (q) =>
        q.eq("userId", args.userId).eq("period", args.period),
      )
      .unique();
    if (row)
      await ctx.db.patch(row._id, {
        status: "failed",
        message: "Digest generation or queueing failed.",
      });
    return null;
  },
});
export const enqueue = internalMutation({
  args: { userId: v.id("users"), period: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!emailEnabled(process.env.SCOUT_EMAIL_ENABLED))
      throw Error("Email sending is not enabled.");
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_userId_and_period", (q) =>
        q.eq("userId", args.userId).eq("period", args.period),
      )
      .unique();
    if (!p?.digestEnabled || !delivery || delivery.outboundId) return null;
    const outboundId = await mail.sendMessage(
      ctx,
      process.env.AGENTMAIL_INBOX_ID!,
      {
        to: p.email,
        subject: "A few opportunities worth your time",
        text: `${args.body}\n\nOpen an opportunity’s link to check the rules and participate. Manage your skills and schedule in Scout Preferences. Optional: reply if you want narrower recommendations. To stop weekly emails, reply STOP or turn off Weekly digest in Preferences.`,
        labels: ["scout-digest"],
      },
    );
    await ctx.db.patch(delivery._id, { outboundId, status: "queued" });
    return null;
  },
});
export const received = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, { message }) => {
    if (
      !emailEnabled(process.env.SCOUT_EMAIL_ENABLED) ||
      message.inbox_id !== process.env.AGENTMAIL_INBOX_ID ||
      typeof message.message_id !== "string"
    )
      return null;
    if (
      await ctx.db
        .query("replyEvents")
        .withIndex("by_messageId", (q) => q.eq("messageId", message.message_id))
        .unique()
    )
      return null;
    const reply = digestReply(message, process.env.AGENTMAIL_INBOX_ID);
    if (!reply) return null;
    const { sender, text } = reply;
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_email", (q) => q.eq("email", sender))
      .first();
    if (!p?.digestEnabled || !message.in_reply_to) return null;
    // Only process replies in threads created by this user's digest.
    const deliveries = await ctx.db
      .query("deliveries")
      .withIndex("by_userId_and_period", (q) => q.eq("userId", p.userId))
      .order("desc")
      .take(10);
    let belongs = false;
    for (const d of deliveries) {
      if (d.outboundId) {
        const status = await mail.status(
          ctx,
          d.outboundId as Parameters<typeof mail.status>[1],
        );
        if (status?.threadId === message.thread_id) {
          belongs = true;
          break;
        }
      }
    }
    if (!belongs) return null;
    await ctx.db.insert("replyEvents", { messageId: message.message_id });
    if (reply.unsubscribe) {
      await ctx.db.patch(p._id, { digestEnabled: false });
      return null;
    }
    await ctx.scheduler.runAfter(0, internal.email.respond, {
      userId: p.userId,
      messageId: message.message_id,
      text,
    });
    return null;
  },
});
export const respond = internalAction({
  args: { userId: v.id("users"), messageId: v.string(), text: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.system.claimAi, { userId: args.userId });
    const body = await ctx.runAction(internal.advisor.generate, {
      userId: args.userId,
      prompt: args.text,
    });
    await ctx.runMutation(internal.email.reply, {
      userId: args.userId,
      messageId: args.messageId,
      body,
    });
    return null;
  },
});
export const reply = internalMutation({
  args: { userId: v.id("users"), messageId: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!p?.digestEnabled || !emailEnabled(process.env.SCOUT_EMAIL_ENABLED))
      return null;
    await mail.replyToMessage(
      ctx,
      process.env.AGENTMAIL_INBOX_ID!,
      args.messageId,
      { text: args.body },
    );
    return null;
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
    if (!emailEnabled(process.env.SCOUT_EMAIL_ENABLED))
      return { threads: [], cursor: "", isDone: true };
    const batch = await ctx.db
      .query("deliveries")
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
  args: { cursor: v.optional(v.string()) },
  returns: v.object({ checked: v.number(), failed: v.number() }),
  handler: async (ctx, args): Promise<{ checked: number; failed: number }> => {
    if (
      process.env.SCOUT_EMAIL_POLLING !== "true" ||
      !emailEnabled(process.env.SCOUT_EMAIL_ENABLED)
    )
      return { checked: 0, failed: 0 };
    const batch = await ctx.runQuery(internal.email.pollTargets, {
      cursor: args.cursor,
    });
    const threads = batch.threads;
    let checked = 0,
      failed = 0;
    for (const threadId of threads) {
      try {
        const thread = await mail.getThread(
          ctx,
          process.env.AGENTMAIL_INBOX_ID!,
          threadId,
        );
        for (const summary of thread.messages ?? []) {
          if (!summary.in_reply_to || summary.labels?.includes("sent"))
            continue;
          const message = await mail.getMessage(
            ctx,
            process.env.AGENTMAIL_INBOX_ID!,
            summary.message_id,
          );
          await ctx.runMutation(internal.email.received, {
            message,
            thread: { thread_id: threadId },
            eventId: `poll:${message.message_id}`,
          });
        }
        checked++;
      } catch {
        failed++;
      }
    }
    if (!batch.isDone)
      await ctx.scheduler.runAfter(1000, internal.email.pollReplies, {
        cursor: batch.cursor,
      });
    return { checked, failed };
  },
});

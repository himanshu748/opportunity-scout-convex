import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { mail } from "./email";
import { isActiveOpportunity } from "../src/availability";
const testKey = "authorized-scout-rentpilot-connection-2026-09-14";
export const send = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("runs")
      .withIndex("by_kind", (q) => q.eq("kind", testKey))
      .first();
    if (existing) {
      const state = await mail.status(
        ctx,
        existing.message as Parameters<typeof mail.status>[1],
      );
      if (
        state?.status !== "failed" ||
        !state.errorMessage?.includes("AGENTMAIL_API_KEY is not set")
      )
        return existing.message;
    }
    const listings = (
      await ctx.db
        .query("opportunities")
        .withIndex("by_status_and_kind", (q) =>
          q.eq("status", "open").eq("kind", "hackathon"),
        )
        .take(30)
    )
      .filter((o) => isActiveOpportunity(o))
      .slice(0, 3);
    if (!listings.length)
      throw new Error("No verified active hackathons to include.");
    const body = [
      "Opportunity Scout — your test digest",
      "",
      "Scout is now connected to the existing RentPilot inbox. This is a connection test with currently active hackathons. Weekly digests are sent only after you sign in and enable them in Preferences.",
      "",
      ...listings.flatMap((o, i) => [
        `${i + 1}. ${o.title}`,
        o.description,
        `Deadline: ${new Date(o.deadline!).toUTCString()}`,
        `Check before applying: ${o.eligibility}`,
        o.url,
        "",
      ]),
      "Only currently open hackathons with confirmed future deadlines are included.",
      "",
      "Scout checks replies to subscribed users’ weekly digest threads every 15 minutes. This standalone connection test verifies outbound delivery; it does not subscribe you.",
    ].join("\n");
    const recipient = process.env.SCOUT_TEST_RECIPIENT;
    const inbox = process.env.AGENTMAIL_INBOX_ID;
    if (!recipient || !inbox)
      throw new Error(
        "Configure an explicitly authorized test recipient and inbox first.",
      );
    const outboundId = await mail.sendMessage(ctx, inbox, {
      to: recipient,
      subject: "Opportunity Scout — RentPilot inbox connected",
      text: body,
      labels: ["opportunity-scout-test"],
    });
    if (existing)
      await ctx.db.patch(existing._id, {
        status: "running",
        message: outboundId,
        startedAt: Date.now(),
      });
    else
      await ctx.db.insert("runs", {
        kind: testKey,
        status: "running",
        message: outboundId,
        startedAt: Date.now(),
      });
    return outboundId;
  },
});
export const status = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("runs")
      .withIndex("by_kind", (q) => q.eq("kind", testKey))
      .first();
    return row
      ? await mail.status(ctx, row.message as Parameters<typeof mail.status>[1])
      : null;
  },
});

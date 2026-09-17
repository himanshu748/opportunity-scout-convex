"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  devpostOpportunity,
  devpostCashPool,
  type DevpostEvent,
} from "../src/devpostSource";
export const sync = internalAction({
  args: { pages: v.optional(v.number()) },
  returns: v.object({
    imported: v.number(),
    queued: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ imported: number; queued: number; failed: number }> => {
    let imported = 0,
      queued = 0,
      failed = 0;
    const events: DevpostEvent[] = [];
    for (let page = 1; page <= Math.min(args.pages ?? 8, 8); page++) {
      try {
        const response = await fetch(
          `https://devpost.com/api/hackathons?status%5B%5D=open&order_by=deadline&page=${page}`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok) throw Error("Platform feed unavailable");
        const data = (await response.json()) as { hackathons?: DevpostEvent[] };
        if (!data.hackathons?.length) break;
        events.push(
          ...data.hackathons.filter(
            (e) => e.open_state === "open" && !e.invite_only,
          ),
        );
      } catch {
        failed++;
        break;
      }
    }
    for (let i = 0; i < events.length; i += 4) {
      await Promise.all(
        events.slice(i, i + 4).map(async (event) => {
          try {
            const url = new URL(event.url);
            if (
              url.protocol !== "https:" ||
              !/^[-a-z\d]+\.devpost\.com$/i.test(url.hostname)
            )
              return;
            const response = await fetch(`${url.origin}/`, {
              signal: AbortSignal.timeout(20000),
            });
            if (!response.ok) throw Error("Page unavailable");
            const html = await response.text();
            const opportunity = devpostOpportunity(event, html, Date.now());
            if (!opportunity) {
              queued += await ctx.runMutation(internal.discovery.enqueue, {
                urls: [event.url],
                channel: "Open platform event requiring deeper verification",
              });
              return;
            }
            let cashFacts = {};
            if (/in cash/.test(html)) {
              try {
                const rules = await fetch(`${url.origin}/rules`, {
                  signal: AbortSignal.timeout(20000),
                });
                if (rules.ok)
                  cashFacts = devpostCashPool(
                    html,
                    await rules.text(),
                    Date.now(),
                  );
              } catch {
                /* Keep the listing, but never confirm unverifiable cash. */
              }
            }
            await ctx.runMutation(internal.board.upsert, {
              ...opportunity,
              ...cashFacts,
            });
            await ctx.runMutation(internal.discovery.imported, {
              url: opportunity.url,
            });
            imported++;
          } catch {
            failed++;
            queued += await ctx.runMutation(internal.discovery.enqueue, {
              urls: [event.url],
              channel: "Open platform event requiring deeper verification",
            });
          }
        }),
      );
    }
    return { imported, queued, failed };
  },
});

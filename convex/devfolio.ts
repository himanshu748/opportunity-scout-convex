"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { devfolioLinks, devfolioOpportunity } from "../src/devfolioSource";
export const sync = internalAction({
  args: {},
  returns: v.object({
    discovered: v.number(),
    imported: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{ discovered: number; imported: number; failed: number }> => {
    const index = await fetch("https://devfolio.co/hackathons", {
      signal: AbortSignal.timeout(20000),
    });
    if (!index.ok) throw new Error(`Devfolio index: ${index.status}`);
    const links = devfolioLinks(await index.text());
    let imported = 0,
      failed = 0;
    for (let i = 0; i < links.length; i += 4)
      await Promise.all(
        links.slice(i, i + 4).map(async (url) => {
          try {
            const page = await fetch(url, {
              signal: AbortSignal.timeout(20000),
            });
            if (!page.ok) throw new Error("Page unavailable");
            const event = devfolioOpportunity(
              url,
              await page.text(),
              Date.now(),
            );
            if (!event) return;
            await ctx.runMutation(internal.board.upsert, event);
            await ctx.runMutation(internal.discovery.imported, { url });
            imported++;
          } catch {
            failed++;
          }
        }),
      );
    return { discovered: links.length, imported, failed };
  },
});

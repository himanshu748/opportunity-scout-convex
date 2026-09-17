"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { directorySources } from "../src/discoveryPlan";
import { directoryLinks } from "../src/directoryDiscovery";
import { lablabOpportunity } from "../src/lablabSource";
/** Cheap public HTML discovery runs independently of search/extraction quotas. */
export const sync = internalAction({
  args: {},
  returns: v.object({
    directories: v.number(),
    discovered: v.number(),
    imported: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    let directories = 0,
      discovered = 0,
      imported = 0,
      failed = 0;
    for (const url of directorySources) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          failed++;
          continue;
        }
        const links = directoryLinks(await response.text(), response.url);
        directories++;
        discovered += await ctx.runMutation(internal.discovery.enqueue, {
          urls: links,
          channel: `Directory: ${url}`,
          depth: 0,
        });
        // A structured organizer source can be verified without an LLM extraction.
        if (url === "https://lablab.ai/ai-hackathons") {
          for (const link of links
            .filter((l) =>
              /^https:\/\/lablab\.ai\/ai-hackathons\/[-a-z\d]+$/.test(l),
            )
            .slice(0, 20)) {
            try {
              const page = await fetch(link, {
                signal: AbortSignal.timeout(15000),
              });
              if (!page.ok) continue;
              const event = lablabOpportunity(
                link,
                await page.text(),
                Date.now(),
              );
              if (!event) continue;
              await ctx.runMutation(internal.board.upsert, event);
              await ctx.runMutation(internal.discovery.imported, {
                url: event.url,
              });
              imported++;
            } catch {
              failed++;
            }
          }
        }
      } catch {
        failed++;
      }
    }
    await ctx.scheduler.runAfter(0, internal.ingest.drain, {});
    return { directories, discovered, imported, failed };
  },
});

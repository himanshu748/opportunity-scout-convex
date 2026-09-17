import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Opportunity } from "./matching";
let request: Promise<Opportunity[]> | undefined;
// One bounded read per page load, shared across React's development remount.
// The public landing page deliberately has no realtime subscription or polling.
export function landingCatalog(): Promise<Opportunity[]> {
  if (!request) {
    const url = import.meta.env.VITE_CONVEX_URL;
    if (!url) return Promise.reject(new Error("Catalog unavailable"));
    request = new ConvexHttpClient(url)
      .query(api.board.page, {
        asOf: Date.now(),
        kind: "hackathon",
        paginationOpts: { cursor: null, numItems: 4 },
      })
      .then((result) => result.page);
  }
  return request;
}

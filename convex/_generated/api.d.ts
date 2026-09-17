/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as advisor from "../advisor.js";
import type * as auth from "../auth.js";
import type * as board from "../board.js";
import type * as crons from "../crons.js";
import type * as discovery from "../discovery.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as mastra_storage from "../mastra/storage.js";
import type * as platformSources from "../platformSources.js";
import type * as profiles from "../profiles.js";
import type * as shortlists from "../shortlists.js";
import type * as system from "../system.js";
import type * as testDelivery from "../testDelivery.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  advisor: typeof advisor;
  auth: typeof auth;
  board: typeof board;
  crons: typeof crons;
  discovery: typeof discovery;
  email: typeof email;
  http: typeof http;
  ingest: typeof ingest;
  "mastra/storage": typeof mastra_storage;
  platformSources: typeof platformSources;
  profiles: typeof profiles;
  shortlists: typeof shortlists;
  system: typeof system;
  testDelivery: typeof testDelivery;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};

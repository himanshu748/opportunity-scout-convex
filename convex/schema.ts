import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraDocumentsTable,
} from "@mastra/convex/schema";
import { authTables } from "@convex-dev/auth/server";
export const opportunityFields = {
  sortEndSoon: v.optional(v.number()),
  sortEndLast: v.optional(v.number()),
  sortPrize: v.optional(v.number()),
  sortCash: v.optional(v.number()),
  validUntil: v.optional(v.number()),
  searchText: v.optional(v.string()),
  title: v.string(),
  organization: v.string(),
  kind: v.union(v.literal("hackathon"), v.literal("gig"), v.literal("grant")),
  description: v.string(),
  url: v.string(),
  skills: v.array(v.string()),
  location: v.string(),
  remote: v.boolean(),
  reward: v.string(),
  cashAmountUSD: v.optional(v.number()),
  cashEvidence: v.optional(v.string()),
  cashVerifiedAt: v.optional(v.number()),
  deadline: v.union(v.number(), v.null()),
  hours: v.union(v.number(), v.null()),
  solo: v.union(v.boolean(), v.null()),
  eligibleRegions: v.optional(v.array(v.string())),
  excludedRegions: v.optional(v.array(v.string())),
  regionEvidence: v.optional(v.string()),
  organizerEvidence: v.optional(v.string()),
  eligibility: v.string(),
  evidence: v.string(),
  checkedAt: v.number(),
  acceptingSubmissions: v.optional(v.boolean()),
  deadlineConfirmed: v.optional(v.boolean()),
  deadlineEvidence: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("closed")),
  origin: v.union(v.literal("source"), v.literal("example")),
};
export default defineSchema({
  ...authTables,
  sourceSubmissions: defineTable({
    userId: v.id("users"),
    url: v.string(),
    submittedAt: v.number(),
  }).index("by_user_time", ["userId", "submittedAt"]),
  discoveryWorker: defineTable({
    name: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_name", ["name"]),
  sourceStats: defineTable({
    name: v.string(),
    sources: v.number(),
    checked: v.number(),
    pending: v.number(),
    failed: v.number(),
    active: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),
  sourceQueue: defineTable({
    url: v.string(),
    leaseUntil: v.optional(v.number()),
    depth: v.optional(v.number()),
    channel: v.string(),
    nextCheckAt: v.number(),
    lastCheckedAt: v.optional(v.number()),
    attempts: v.number(),
    retryCount: v.optional(v.number()),
    result: v.optional(v.string()),
  })
    .index("by_url", ["url"])
    .index("by_nextCheckAt", ["nextCheckAt"])
    .index("by_leaseUntil", ["leaseUntil"]),
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_documents: mastraDocumentsTable,
  aiLimits: defineTable({ userId: v.id("users"), lastAt: v.number() }).index(
    "by_userId",
    ["userId"],
  ),
  opportunities: defineTable(opportunityFields)
    .index("by_status_prize", ["status", "sortPrize"])
    .index("by_status_kind_prize", ["status", "kind", "sortPrize"])
    .index("by_status_created", ["status"])
    .index("by_status_soon", ["status", "sortEndSoon"])
    .index("by_status_last", ["status", "sortEndLast"])
    .index("by_status_cash", ["status", "sortCash"])
    .index("by_status_kind_soon", ["status", "kind", "sortEndSoon"])
    .index("by_status_kind_last", ["status", "kind", "sortEndLast"])
    .index("by_status_kind_cash", ["status", "kind", "sortCash"])
    .index("by_status_and_kind", ["status", "kind"])
    .index("by_validUntil", ["validUntil"])
    .index("by_kind_and_validUntil", ["kind", "validUntil"])
    .index("by_url", ["url"])
    .searchIndex("search_catalog", {
      searchField: "searchText",
      filterFields: ["status", "kind"],
    })
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["status", "kind"],
    }),
  profiles: defineTable({
    userId: v.id("users"),
    skills: v.array(v.string()),
    location: v.string(),
    hours: v.number(),
    solo: v.boolean(),
    goal: v.union(
      v.literal("learn"),
      v.literal("earn"),
      v.literal("portfolio"),
    ),
    email: v.string(),
    digestEnabled: v.boolean(),
    nextDigestAt: v.number(),
    threadId: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_digestEnabled_and_nextDigestAt", [
      "digestEnabled",
      "nextDigestAt",
    ])
    .index("by_email", ["email"]),
  saved: defineTable({
    userId: v.id("users"),
    opportunityId: v.id("opportunities"),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_opportunityId", ["userId", "opportunityId"]),
  shortlists: defineTable({
    userId: v.id("users"),
    body: v.string(),
    opportunityIds: v.array(v.id("opportunities")),
    request: v.string(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
  runs: defineTable({
    kind: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    message: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_kind", ["kind"]),
  deliveries: defineTable({
    userId: v.id("users"),
    period: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    outboundId: v.optional(v.string()),
    message: v.optional(v.string()),
  }).index("by_userId_and_period", ["userId", "period"]),
  replyEvents: defineTable({ messageId: v.string() }).index("by_messageId", [
    "messageId",
  ]),
});

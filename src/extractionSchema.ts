import { z } from "zod";
export const record = z.object({
  isOpportunity: z.boolean(),
  closedConfirmed: z.boolean(),
  closureEvidence: z.string(),
  acceptingSubmissions: z.boolean(),
  deadlineConfirmed: z.boolean(),
  deadlineEvidence: z.string().default(""),
  title: z.string(),
  organization: z.string(),
  kind: z.enum(["hackathon", "gig", "grant"]),
  description: z.string(),
  skills: z.array(z.string()).max(12),
  location: z.string(),
  remote: z.boolean(),
  reward: z.string(),
  cashEvidence: z.string().default(""),
  eligibleRegions: z.array(z.string()).max(40).default([]),
  excludedRegions: z.array(z.string()).max(40).default([]),
  regionEvidence: z.string().default(""),
  organizerEvidence: z.string().default(""),
  deadline: z.string().nullable(),
  deadlineDate: z.string().default(""),
  hours: z.number().positive().nullable(),
  solo: z.boolean().nullable(),
  eligibility: z.string(),
  evidence: z.string().max(250),
});
// Convex values reject keys beginning with $. This flat schema needs no JSON Schema dialect marker.
export const { $schema: _dialect, ...extractionSchema } =
  z.toJSONSchema(record);

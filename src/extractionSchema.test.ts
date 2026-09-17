import { expect, it } from "vitest";
import { convexToJson } from "convex/values";
import { extractionSchema } from "./extractionSchema";
it("transports the actual Firecrawl schema through Convex without reserved field errors", () => {
  expect(() =>
    convexToJson({
      formats: [{ type: "json", schema: extractionSchema }],
    } as any),
  ).not.toThrow();
  expect(extractionSchema.properties?.kind).toMatchObject({
    enum: ["hackathon", "gig", "grant"],
  });
});

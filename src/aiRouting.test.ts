import { describe, expect, it } from "vitest";
import { aiProvider, hasAiConfiguration } from "./aiRouting";

describe("explicit AI billing route", () => {
  it("keeps Convex selected even when legacy provider credentials remain", () => {
    const env = {
      SCOUT_AI_PROVIDER: "convex",
      AI_GATEWAY_API_KEY: "legacy",
      OPENAI_API_KEY: "legacy",
    };
    expect(aiProvider(env)).toBe("convex");
    expect(hasAiConfiguration({ SCOUT_AI_PROVIDER: "convex" })).toBe(true);
  });
  it("does not silently fall back from an explicitly selected provider", () => {
    expect(
      hasAiConfiguration({
        SCOUT_AI_PROVIDER: "vercel",
        OPENAI_API_KEY: "other",
      }),
    ).toBe(false);
    expect(
      hasAiConfiguration({
        SCOUT_AI_PROVIDER: "openai",
        AI_GATEWAY_API_KEY: "other",
      }),
    ).toBe(false);
    expect(() =>
      aiProvider({ SCOUT_AI_PROVIDER: "conevx", AI_GATEWAY_API_KEY: "other" }),
    ).toThrow();
  });
  it("preserves the existing deployment route before cutover", () => {
    expect(aiProvider({ AI_GATEWAY_API_KEY: "existing" })).toBe("vercel");
    expect(aiProvider({ OPENAI_API_KEY: "existing" })).toBe("openai");
    expect(hasAiConfiguration({})).toBe(false);
  });
});

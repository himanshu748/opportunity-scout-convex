export type AiProvider = "convex" | "vercel" | "openai";
export type AiEnvironment = {
  SCOUT_AI_PROVIDER?: string;
  AI_GATEWAY_API_KEY?: string;
  OPENAI_API_KEY?: string;
};

export function aiProvider(env: AiEnvironment): AiProvider {
  const configured = env.SCOUT_AI_PROVIDER;
  if (configured) {
    if (
      configured === "convex" ||
      configured === "vercel" ||
      configured === "openai"
    )
      return configured;
    throw new Error("SCOUT_AI_PROVIDER must be convex, vercel, or openai.");
  }
  return env.AI_GATEWAY_API_KEY ? "vercel" : "openai";
}

export function hasAiConfiguration(env: AiEnvironment): boolean {
  switch (aiProvider(env)) {
    case "convex":
      return true;
    case "vercel":
      return !!env.AI_GATEWAY_API_KEY;
    case "openai":
      return !!env.OPENAI_API_KEY;
  }
}

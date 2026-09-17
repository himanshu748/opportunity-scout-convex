/** Source-specific parser for the official event the builder is participating in.
 * The fixed date is evidence-backed, not rolled forward to the next year. */
export function allGasSource(url: string, markdown: string, now: number) {
  if (
    url !== "https://www.convex.dev/hackathons/all-gas" ||
    now >= 1790103600000
  )
    return null;
  if (
    !/Submissions are due Sep 22,?\s*12:00 PM PT/i.test(markdown) ||
    !/Only new apps started on or after August 25/i.test(markdown)
  )
    return null;
  return {
    title: "Convex All Gas Hackathon",
    organization: "Convex",
    kind: "hackathon" as const,
    description:
      "Build a new everyday app with Convex, OpenAI, Firecrawl, and AgentMail. Submit a public repository, hosted app, build log, and a three-minute demo.",
    url,
    skills: ["React", "TypeScript", "Convex", "AI"],
    location: "Worldwide, with eligibility exclusions",
    remote: true,
    reward: "Cash prizes and Codex credits; see prize breakdown",
    deadline: 1790103600000,
    hours: null,
    solo: null,
    eligibility:
      "Age 18+. New apps started on or after August 25, 2026. Geographic exclusions apply; see official rules.",
    evidence: "Submissions are due Sep 22, 12:00 PM PT.",
    checkedAt: now,
    status: "open" as const,
    origin: "source" as const,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
}

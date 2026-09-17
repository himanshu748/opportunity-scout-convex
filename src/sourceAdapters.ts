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

/** Fixed, independently checked 2026 grant window; never infer a later cycle. */
export function rConsortiumSource(url: string, markdown: string, now: number) {
  const deadline = Date.parse("2026-10-01T23:59:00-04:00");
  const evidence = "closes October 1, 2026, at 11:59 p.m. US Eastern Time";
  if (
    url !==
      "https://r-consortium.org/posts/r-consortium-now-accepting-submissions-for-technical-grants/index.html" ||
    now >= deadline ||
    !markdown.includes(evidence) ||
    !markdown.includes("now accepting proposals") ||
    !markdown.includes("R Consortium")
  )
    return null;
  return {
    title: "R Consortium Technical Grants Cycle 2026",
    organization: "R Consortium",
    kind: "grant" as const,
    description:
      "Funding for open-source R software, developer tools, and community programs. Submit a focused 2–5 page proposal with deliverables using the ISC template.",
    url,
    skills: ["R", "Open source", "Developer tools"],
    location: "Worldwide",
    remote: true,
    reward: "Grant amount not specified; funding paid in two milestones",
    deadline,
    deadlineEvidence: evidence,
    hours: null,
    solo: null,
    eligibility:
      "Projects must benefit the wider R ecosystem. Use the official ISC proposal template and review the funding criteria.",
    evidence,
    organizerEvidence: "R Consortium",
    checkedAt: now,
    status: "open" as const,
    origin: "source" as const,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
}

import type { Opportunity } from "./matching";
const base = {
  location: "Anywhere",
  remote: true,
  deadline: null,
  hours: null,
  solo: null,
  eligibility:
    "Illustrative listing. Check the original source for actual requirements.",
  evidence:
    "This is sample content for exploring the interface, not an available opportunity.",
  checkedAt: 0,
  status: "open" as const,
  origin: "example" as const,
};
export const examples: Opportunity[] = [
  {
    ...base,
    _id: "example-1",
    title: "Build something people use",
    organization: "Example hackathon",
    kind: "hackathon",
    description:
      "Turn a small everyday frustration into a working product. Bring your own idea, build a useful demo, and show how it works.",
    url: "https://www.convex.dev/hackathons/all-gas",
    skills: ["React", "TypeScript", "AI"],
    reward: "See event rules",
    hours: 16,
    solo: true,
  },
  {
    ...base,
    _id: "example-2",
    title: "A better booking flow",
    organization: "Example freelance brief",
    kind: "gig",
    description:
      "Help an independent studio simplify its booking experience. A focused frontend project with room for thoughtful interaction design.",
    url: "https://contra.com",
    skills: ["React", "Design"],
    reward: "Budget to be confirmed",
    hours: 8,
    solo: true,
  },
  {
    ...base,
    _id: "example-3",
    title: "Make open data useful",
    organization: "Example community challenge",
    kind: "hackathon",
    description:
      "Explore a public dataset and build a small tool that helps someone make a better decision.",
    url: "https://devpost.com/hackathons",
    skills: ["Python", "Data", "AI"],
    reward: "See event rules",
    hours: 12,
    solo: true,
  },
  {
    ...base,
    _id: "example-4",
    title: "Ship a polished landing page",
    organization: "Example freelance brief",
    kind: "gig",
    description:
      "Translate an early-stage product brief into an accessible, responsive landing page with a clear visual identity.",
    url: "https://contra.com",
    skills: ["TypeScript", "Design"],
    reward: "Budget to be confirmed",
    hours: 6,
    solo: true,
  },
  {
    ...base,
    _id: "example-5",
    title: "Small tools, real impact",
    organization: "Example weekend challenge",
    kind: "hackathon",
    description:
      "Spend a weekend building a focused tool for a community you know. The brief rewards useful details and clear execution.",
    url: "https://devpost.com/hackathons",
    skills: ["React", "AI"],
    reward: "See event rules",
    hours: 10,
    solo: true,
  },
];

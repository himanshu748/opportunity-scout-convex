import { dateOnlyDeadline } from "./dateOnlyDeadline";
function plain(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/** Recognize the organizer's explicit combined registration/submission heading.
 * Other templates fall back to evidence extraction, never event-end dates. */
export function hack2skillOpportunity(url: string, html: string, now: number) {
  if (!/^https:\/\/hack2skill\.com\/event\/[-a-z\d]+\/?$/.test(url))
    return null;
  const text = plain(html);
  const title = plain(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "");
  const evidence =
    /Registration\s*&\s*first submission deadline\s+(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/i.exec(
      text,
    );
  if (!title || !evidence || !/hackathon/i.test(title)) return null;
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const month = months.indexOf(evidence[2].slice(0, 3).toLowerCase()) + 1;
  const date = `${evidence[3]}-${String(month).padStart(2, "0")}-${evidence[1].padStart(2, "0")}`;
  const deadline = dateOnlyDeadline(date, evidence[0], text);
  if (
    deadline === null ||
    deadline <= now ||
    !/register|registration/i.test(text)
  )
    return null;
  const cash = /Cash awards worth\s*₹\s*([\d.]+)\s*Lakhs?/i.exec(text);
  return {
    title,
    organization: "Hack2Skill",
    kind: "hackathon" as const,
    description:
      "Submit through the official Hack2Skill event page. Check the brief for stages, team rules and participation requirements.",
    url: url.replace(/\/$/, ""),
    skills: /\bAI\b/.test(title) ? ["AI"] : [],
    location: /Indian citizens/i.test(text)
      ? "India · check venue"
      : "Check event venue",
    remote: /\bvirtual\b/i.test(text) && !/\bhybrid\b/i.test(text),
    reward: cash
      ? `${cash[0]}; other awards may include credits`
      : "See official prize breakdown",
    ...(cash
      ? {
          cashAmount: Number(cash[1]) * 100000,
          cashCurrency: "INR",
          cashStatus: "confirmed" as const,
          cashEvidence: cash[0],
          cashVerifiedAt: now,
        }
      : {}),
    deadline,
    deadlineDate: date,
    hours: null,
    solo: /2-4 Member Teams/i.test(text) ? false : null,
    eligibility: `${/Indian citizens/i.test(text) ? "Indian citizens only. " : ""}${/Age 18\+/i.test(text) ? "Age 18+. " : ""}Check team requirements and selection stages on the official page. Exact closing time is not published.`,
    evidence: evidence[0],
    deadlineEvidence: evidence[0],
    checkedAt: now,
    status: "open" as const,
    origin: "source" as const,
    acceptingSubmissions: true,
    deadlineConfirmed: true,
  };
}

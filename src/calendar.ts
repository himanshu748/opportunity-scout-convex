import type { Opportunity } from "./matching";
import { isActiveOpportunity } from "./availability";
const stamp = (time: number) =>
  new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "",
    length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) {
      result += "\r\n ";
      length = 1;
    }
    result += char;
    length += bytes;
  }
  return result;
}
export function opportunityCalendar(item: Opportunity, now = Date.now()) {
  if (
    !isActiveOpportunity(item, now) ||
    !item.deadlineConfirmed ||
    Boolean(item.deadlineDate) ||
    item.deadline === null
  )
    throw new Error(
      "Only active opportunities with confirmed deadlines can be added to a calendar.",
    );
  const url = new URL(item.url);
  if (url.protocol !== "https:" || /[\r\n]/.test(item.url))
    throw new Error("Invalid source URL.");
  const remaining = item.deadline - now;
  const reminder =
    remaining > 86400000 ? "-P1D" : remaining > 3600000 ? "-PT1H" : null;
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Opportunity Scout//Deadline//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(item._id)}@opportunity-scout`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(item.deadline)}`,
      `DTEND:${stamp(item.deadline + 15 * 60000)}`,
      `SUMMARY:${escapeText(`Submission deadline: ${item.title}`)}`,
      `DESCRIPTION:${escapeText(`${item.organization}\n${item.eligibility}\nCheck the official source for changes: ${item.url}\nThis is a deadline reminder, not a registration.`)}`,
      `URL:${url.href}`,
      ...(reminder
        ? [
            "BEGIN:VALARM",
            `TRIGGER:${reminder}`,
            "ACTION:DISPLAY",
            "DESCRIPTION:Opportunity deadline approaching",
            "END:VALARM",
          ]
        : []),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
export function downloadDeadline(item: Opportunity) {
  const objectUrl = URL.createObjectURL(
    new Blob([opportunityCalendar(item)], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "scout-deadline.ics";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

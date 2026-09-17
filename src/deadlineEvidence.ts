/** Conservative acceptance: unsupported date formats remain unconfirmed. */
export function verifiesDeadline(
  iso: string | null,
  quote: string,
  markdown: string,
) {
  if (!iso || !quote || !markdown.includes(quote)) return false;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return false;
  if (
    !/\b(deadline|submit|submissions?|applications?|closes?|ends?)\b/i.test(
      quote,
    )
  )
    return false;
  // Award announcements and judging windows are not application deadlines.
  if (/winner|judging|announcement|results/i.test(quote)) return false;
  const explicitOffset = /\b(?:GMT|UTC)([+-])(\d{1,2}):?(\d{2})?\b/.exec(quote);
  const offsetMinutes = explicitOffset
    ? (explicitOffset[1] === "+" ? 1 : -1) *
      (Number(explicitOffset[2]) * 60 + Number(explicitOffset[3] ?? 0))
    : 0;
  if (
    explicitOffset &&
    (Number(explicitOffset[2]) > 14 || Number(explicitOffset[3] ?? 0) > 59)
  )
    return false;
  const zone = explicitOffset
    ? "UTC"
    : /\bIndia Standard Time\b|\bIST\b.*\bIndia\b|\bIndia\b.*\bIST\b/i.test(
          quote,
        )
      ? "Asia/Kolkata"
      : /\bJST\b/.test(quote)
        ? "Asia/Tokyo"
        : /\bSGT\b/.test(quote)
          ? "Asia/Singapore"
          : /US\s+(?:Eastern(?:\s+Time)?|ET)|\bAmerica\/New_York\b/i.test(quote)
            ? "America/New_York"
            : /\bEDT\b/.test(quote)
              ? "Etc/GMT+4"
              : /\bEST\b/.test(quote)
                ? "Etc/GMT+5"
                : /US\s+(?:Pacific(?:\s+Time)?|PT)|\bAmerica\/Los_Angeles\b/i.test(
                      quote,
                    )
                  ? "America/Los_Angeles"
                  : /\bPDT\b/.test(quote)
                    ? "Etc/GMT+7"
                    : /\bPST\b/.test(quote)
                      ? "Etc/GMT+8"
                      : /\bCEST\b/.test(quote)
                        ? "Etc/GMT-2"
                        : /\bCET\b/.test(quote)
                          ? "Etc/GMT-1"
                          : /\b(?:UTC|GMT)\b(?!\s*[+-])/.test(quote)
                            ? "UTC"
                            : null;
  if (!zone) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(date.getTime() + offsetMinutes * 60000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const text = quote.toLowerCase().replace(/\./g, "");
  const month = get("month").toLowerCase(),
    day = get("day"),
    year = get("year");
  const monthPattern = `(?:${month}|${month.slice(0, 3)})`;
  if (
    !text.includes(year) ||
    !new RegExp(
      `(?:${monthPattern}\\s+${day}(?:st|nd|rd|th)?\\b|\\b${day}(?:st|nd|rd|th)?\\s+${monthPattern})`,
    ).test(text)
  )
    return false;
  const hour = get("hour"),
    minute = get("minute"),
    period = get("dayPeriod").toLowerCase();
  const time12 = new RegExp(`\\b${hour}(?::${minute})?\\s*${period}\\b`);
  const hour24 = (Number(hour) % 12) + (period === "pm" ? 12 : 0);
  const time24 = new RegExp(
    `\\b${String(hour24).padStart(2, "0")}:${minute}\\b`,
  );
  return (
    (minute === "00"
      ? time12.test(text)
      : new RegExp(`\\b${hour}:${minute}\\s*${period}\\b`).test(text)) ||
    time24.test(text)
  );
}

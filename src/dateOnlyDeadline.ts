/** Calendar dates are not timestamps. Expire at the earliest start of that date
 * worldwide (UTC+14) rather than inventing a closing time or showing expired events. */
export function dateOnlyDeadline(
  date: string | undefined,
  quote: string,
  source: string,
) {
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !quote ||
    !source.includes(quote)
  )
    return null;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(stamp) ||
    new Date(stamp).toISOString().slice(0, 10) !== date
  )
    return null;
  if (
    !/deadline|submissions?\s+(?:close|end)|applications?\s+(?:close|end)|registration\s+(?:close|end)/i.test(
      quote,
    ) ||
    /judging|winner|announcement/i.test(quote)
  )
    return null;
  const [year, month, day] = date.split("-").map(Number);
  const name = new Date(stamp)
    .toLocaleString("en-US", { month: "long", timeZone: "UTC" })
    .toLowerCase();
  const text = quote.toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ");
  const m = `(?:${name}|${name.slice(0, 3)}${month === 9 ? "t?" : ""})`;
  if (
    !text.includes(String(year)) ||
    !(
      text.includes(date) ||
      new RegExp(
        `(?:${m}\\s+0?${day}(?:st|nd|rd|th)?\\b|\\b0?${day}(?:st|nd|rd|th)?\\s+${m}\\b)`,
      ).test(text)
    )
  )
    return null;
  return stamp - 14 * 3600000;
}

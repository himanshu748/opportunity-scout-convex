/** Rolling coverage, not a claim of an exhaustive internet index. */
export function discoveryQueries(now: number, topic = "") {
  const month = new Date(now).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const themes = [
    `hackathon submissions open deadline ${month}`,
    `developer challenge build competition prizes submissions ${month}`,
    `AI agent hackathon sponsor official rules deadline ${month}`,
    `university student innovation hackathon registration open ${month}`,
    `community weekend online hackathon register ${month}`,
    `open source bounty paid developer project apply ${month}`,
    `site:dev.to challenge submissions deadline ${month}`,
    `site:github.com hackathon challenge rules ${month}`,
    `site:convex.dev hackathon competition ${month}`,
    `site:lu.ma hackathon builders ${month}`,
    `site:luma.com hackathon builders ${month}`,
    `site:ethglobal.com events hackathon ${month}`,
    `design datathon research challenge submissions open ${month}`,
    `developer tools launch competition build challenge ${month}`,
    `India remote hackathon registration ${month}`,
    `Africa Europe Asia community hackathon remote ${month}`,
    `site:itch.io/jam upcoming game jam ${month}`,
    `site:kaggle.com/competitions deadline ${month}`,
    `remote small paid React TypeScript freelance project ${month}`,
    `developer bounty microgrant open applications ${month}`,
    `"hackathon" "official rules" "${new Date(now).getUTCFullYear()}"`,
    `"build challenge" "submit" "deadline" ${month}`,
    `"hackathon" "registration open" -site:devpost.com ${month}`,
    `"coding competition" "prizes" "deadline" ${month}`,
  ];
  const offset = (Math.floor(now / 86400000) % 4) * 6;
  const daily = [
    `independent community hackathon organizer application deadline ${month}`,
    `sponsor developer builder grant applications official ${month}`,
    `developer open source grants funding applications eligibility ${month}`,
    `India Africa Europe developer grants fellowship open applications ${month}`,
  ];
  return [
    ...(topic.trim()
      ? [
          `${topic.trim().slice(0, 120)} hackathon challenge paid project official deadline ${month}`,
        ]
      : []),
    ...themes.slice(offset, offset + 6),
    ...daily,
  ];
}
export function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      /(^|\.)(x\.com|twitter\.com|t\.co)$/.test(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(url.hostname) ||
      !url.hostname.includes(".")
    )
      return null;
    if (
      /\.(png|jpe?g|gif|webp|svg|ico|mp4|mp3|woff2?|ttf|zip)$/i.test(
        url.pathname,
      ) ||
      /^\/new\/?$/.test(url.pathname) ||
      /^(images\.|media\d?\.|avatars\.|camo\.)/i.test(url.hostname) ||
      /(^|\/)(signin|sign-in|signup|sign-up|login|logout|report-abuse|contact)(\/|$)/i.test(
        url.pathname,
      )
    )
      return null;
    if (
      url.hostname === "github.com" &&
      /\/(commit|commits|pull|pulls|issues|tags|branches|stargazers|forks|watchers|actions)(\/|$)/.test(
        url.pathname,
      )
    )
      return null;
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|ref_|ref$|fbclid$|gclid$)/i.test(key))
        url.searchParams.delete(key);
    return url.href;
  } catch {
    return null;
  }
}
export function opportunityLinks(markdown: string, base: string) {
  const links = new Set<string>();
  for (const match of markdown.matchAll(/\[([^\]]+)\]\(([^\s)]+)\)/g)) {
    if (
      !/hackathon|challenge|competition|bounty|gig|grant|funding|fellowship|rules|register|apply|submit|jam|\.devpost\.com|\/events\//i.test(
        `${match[1]} ${match[2]}`,
      )
    )
      continue;
    try {
      const url = normalizeSourceUrl(new URL(match[2], base).href);
      if (url && url !== base) links.add(url);
    } catch {
      /* Ignore malformed source links. */
    }
  }
  return [...links].slice(0, 40);
}

export const directorySources = [
  "https://devpost.com/hackathons?status%5B%5D=open",
  "https://lablab.ai/ai-hackathons",
  "https://devfolio.co/hackathons",
  "https://unstop.com/hackathons",
  "https://dorahacks.io/hackathon",
  "https://ethglobal.com/events",
  "https://dev.to/challenges",
  "https://hackathons.hackclub.com/",
];
/** Prefer actual event pages over more community calendars and roundup articles. */
export function sourcePriority(url: string, result?: string) {
  if (result === "active") return -10;
  const u = new URL(url);
  if (/^[^.]+\.devpost\.com$/.test(u.hostname)) return -8;
  if (
    /\/(hackathon|hackathons|ai-hackathons|events|event|challenges)\/[^/]+/.test(
      u.pathname,
    )
  )
    return -6;
  if (
    /^(lu\.ma|luma\.com)$/.test(u.hostname) &&
    /^\/[a-z\d]{8}$/.test(u.pathname)
  )
    return -4;
  if (/hackathon|challenge|competition|bounty/i.test(u.pathname)) return -2;
  return 0;
}

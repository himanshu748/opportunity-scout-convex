const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function inline(s: string): string {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let html = "",
    start = 0;
  for (const m of s.matchAll(pattern)) {
    html += escape(s.slice(start, m.index));
    html += m[3]
      ? `<strong>${escape(m[3])}</strong>`
      : `<a href="${escape(m[2])}" style="color:#344d45;text-decoration:underline">${escape(m[1])}</a>`;
    start = m.index! + m[0].length;
  }
  return html + escape(s.slice(start));
}
/** Deliberately limited email markup. Source/AI HTML is always escaped. */
export function formatScoutEmail(markdown: string, reply = false) {
  const footer =
    "Reply with a narrower constraint to refine your shortlist. Reply STOP to unsubscribe. Review the original rules before applying.";
  const text =
    markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)") +
    "\n\n" +
    footer;
  const blocks = markdown
    .replace(/(^[^\n-][^\n]*)\n(?=- )/gm, "$1\n\n")
    .split(/\n\s*\n/)
    .map((block) => {
      if (/^#{1,6}\s/.test(block))
        return `<h2 style="font-size:20px;line-height:1.4;margin:28px 0 12px">${inline(block.replace(/^#{1,6}\s+/, ""))}</h2>`;
      if (block.split("\n").every((line) => /^- /.test(line)))
        return `<ul style="padding-left:22px;margin:12px 0">${block
          .split("\n")
          .map(
            (line) => `<li style="margin:7px 0">${inline(line.slice(2))}</li>`,
          )
          .join("")}</ul>`;
      return `<p style="margin:12px 0;line-height:1.65">${inline(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f4f3ef;color:#272c29;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;background:#fff;padding:24px;border:1px solid #dedfd8;border-radius:12px"><p style="font-size:12px;letter-spacing:2px;color:#52645a">OPPORTUNITY SCOUT</p><h1 style="font-size:26px;line-height:1.3">${reply ? "Your refined shortlist" : "Your hackathon shortlist"}</h1>${blocks}<hr style="border:0;border-top:1px solid #dedfd8;margin:24px 0"><p style="font-size:13px;line-height:1.6;color:#58615b">${footer}</p><p style="font-size:13px"><a href="https://graceful-spoonbill-850.convex.site/app" style="color:#344d45">Open Scout</a></p></main></body></html>`;
  return { text, html };
}

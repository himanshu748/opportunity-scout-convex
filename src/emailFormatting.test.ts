import { expect, it } from "vitest";
import { formatScoutEmail } from "./emailFormatting";
import { readScoutThread } from "./scoutMailbox";
import { vi, afterEach } from "vitest";
afterEach(() => vi.unstubAllGlobals());
it("formats headings, lists and links with readable plain text", () => {
  const x = formatScoutEmail(
    "### 1. [Build](https://example.com)\n\n**Cash:** USD 50\n\n- Check rules\n- Build",
  );
  expect(x.html).toContain("<h2");
  expect(x.html).toContain("<li");
  expect(x.html).toContain("<strong>Cash:</strong>");
  expect(x.text).toContain("1. Build (https://example.com)");
  expect(x.text).not.toContain("**");
  expect(x.text).not.toContain("###");
  expect(x.text).toContain("STOP");
});
it("escapes source HTML and rejects executable link markup", () => {
  const x = formatScoutEmail(
    "<img src=x onerror=alert(1)> [bad](javascript:alert) **<script>**",
    true,
  );
  expect(x.html).not.toContain("<img");
  expect(x.html).not.toContain("<script>");
  expect(x.html).not.toContain('href="javascript:');
  expect(x.html).toContain("Your refined shortlist");
});
it("reads only messages in the authorized thread and encodes message IDs", async () => {
  const message = {
    inbox_id: "scout@example.com",
    thread_id: "owned",
    message_id: "<reply@example.com>",
    in_reply_to: "root",
    labels: ["received"],
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          inbox_id: message.inbox_id,
          thread_id: "owned",
          messages: [message, { ...message, thread_id: "foreign" }],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(message)));
  vi.stubGlobal("fetch", fetch);
  expect(await readScoutThread(message.inbox_id, "owned", "fixture")).toEqual([
    message,
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(fetch.mock.calls[1][0])).toContain("%3Creply%40example.com%3E");
});
it("rejects foreign thread and failed provider without processing messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ thread_id: "foreign", inbox_id: "scout" }),
        ),
      ),
  );
  await expect(readScoutThread("scout", "owned", "fixture")).rejects.toThrow(
    "ownership",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("", { status: 503 })),
  );
  await expect(readScoutThread("scout", "owned", "fixture")).rejects.toThrow(
    "503",
  );
});

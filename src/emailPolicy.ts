export function emailEnabled(value: string | undefined) {
  return value === "true";
}
export function digestReply(message: Record<string, unknown>, inbox: string | undefined) {
  if (!inbox || message.inbox_id !== inbox || typeof message.message_id !== "string" || typeof message.thread_id !== "string" || !message.in_reply_to) return null;
  const from = typeof message.from === "string" ? message.from : "";
  const sender = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  const text = String(message.extracted_text ?? message.text ?? "").trim().slice(0, 1500);
  if (!sender || !text) return null;
  return {sender, text, unsubscribe: /^(stop|unsubscribe)\b/i.test(text)};
}

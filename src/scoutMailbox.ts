/** Called only from the internal poller after it resolves Scout-owned delivery threads.
 * No public endpoint or broader component export is introduced. */
export async function readScoutThread(
  inbox: string,
  threadId: string,
  key: string,
) {
  const read = async (path: string) => {
    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/${path}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error(`Scout mailbox read failed (${response.status})`);
    return await response.json();
  };
  const thread = await read(`threads/${encodeURIComponent(threadId)}`);
  if (thread.thread_id !== threadId || thread.inbox_id !== inbox)
    throw Error("Thread ownership mismatch");
  const messages = [];
  for (const summary of (thread.messages ?? []).slice(-20)) {
    if (!summary.in_reply_to || summary.labels?.includes("sent")) continue;
    if (summary.thread_id !== threadId || summary.inbox_id !== inbox) continue;
    const message = await read(
      `messages/${encodeURIComponent(summary.message_id)}`,
    );
    if (message.thread_id !== threadId || message.inbox_id !== inbox)
      throw Error("Message ownership mismatch");
    messages.push(message);
  }
  return messages;
}

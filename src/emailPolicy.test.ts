import { expect, it } from "vitest";
import { digestReply, emailEnabled } from "./emailPolicy";
it("requires an explicit enabled flag, including when configuration is the string false", () => {
  for (const value of [undefined, "", "false", "0"]) expect(emailEnabled(value)).toBe(false);
  expect(emailEnabled("true")).toBe(true);
});
it("ignores other inboxes and new messages when sharing a RentPilot inbox", () => {
  const message = {inbox_id:"rentpilot@agentmail.to",message_id:"msg",thread_id:"thread",in_reply_to:"digest",from:"Builder <builder@example.com>",text:"Only solo options"};
  expect(digestReply(message,"scout@agentmail.to")).toBeNull();
  expect(digestReply({...message,in_reply_to:undefined},message.inbox_id)).toBeNull();
  expect(digestReply(message,message.inbox_id)).toEqual({sender:"builder@example.com",text:"Only solo options",unsubscribe:false});
  expect(digestReply({...message,extracted_text:"STOP",text:"quoted digest"},message.inbox_id)?.unsubscribe).toBe(true);
});

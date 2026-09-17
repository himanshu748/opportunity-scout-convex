import { expect, it } from "vitest";
import { profileInput } from "./profileInput";
it("can save an edited persisted profile without leaking query metadata into mutation arguments", () => {
  const persisted = { _id: "profile-id", _creationTime: 1, userId: "user-id", threadId: "thread", email: "qa@example.invalid", nextDigestAt: 100, skills: ["React"], location: "India", hours: 20, solo: true, goal: "portfolio" as const, digestEnabled: true };
  expect(profileInput({...persisted, hours: 12}, false)).toEqual({skills: ["React"], location: "India", hours: 12, solo: true, goal: "portfolio", digestEnabled: false});
});

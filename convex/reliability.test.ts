import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import {
  componentsGeneric,
  internalActionGeneric,
  mutationGeneric,
} from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { internal, api } from "./_generated/api";
import agentmail from "@agentmail/convex/test";
import workpool from "@convex-dev/workpool/test";
import { profileKey, digestPeriod, WEEK } from "../src/deliveryPolicy";
import { decisionFingerprint } from "../src/eventIdentity";
import { mail } from "./email";
import type { Id } from "./_generated/dataModel";
const modules = import.meta.glob(["./**/*.{ts,js}", "!./**/*.test.ts"]);
const now = Date.UTC(2026, 8, 20);
const fixture = {
  title: "Build 2026",
  organization: "Acme",
  kind: "hackathon" as const,
  description: "Build a developer tool",
  url: "https://build.devpost.com",
  skills: ["TypeScript"],
  location: "India",
  remote: true,
  reward: "Non-cash credits",
  deadline: now + WEEK,
  hours: 8,
  solo: true,
  eligibility: "Review full rules",
  evidence: "Submissions open",
  checkedAt: now,
  status: "open" as const,
  origin: "source" as const,
  acceptingSubmissions: true,
  deadlineConfirmed: true,
};
const c = componentsGeneric() as any;
function setup(failAI = false) {
  const t = convexTest({
    schema,
    modules: {
      ...modules,
      ...(failAI
        ? {
            "./advisor.ts": async () => ({
              generate: internalActionGeneric({
                args: { userId: v.id("users"), prompt: v.string() },
                handler: async () => {
                  throw Error("Injected AI outage");
                },
              }),
            }),
          }
        : {}),
    },
    transactionLimits: { bytesRead: 1024 * 1024, documentsRead: 1000 },
  });
  t.registerComponent("agentmail", agentmail.schema, {
    ...import.meta.glob(
      "../node_modules/@agentmail/convex/src/component/**/*.{ts,js}",
    ),
    "../node_modules/@agentmail/convex/src/component/testSupport.ts":
      async () => ({
        accept: mutationGeneric({
          args: { outboundId: v.string() },
          handler: async (ctx, args) =>
            ctx.db.patch(args.outboundId as any, {
              status: "sent",
              agentmailMessageId: "digest-message",
              threadId: "scout-thread",
            }),
        }),
      }),
  });
  for (const path of ["agentmail/sendPool", "agentmail/callbackPool"])
    t.registerComponent(
      path,
      workpool.schema,
      import.meta.glob(
        "../node_modules/@convex-dev/workpool/src/component/**/*.{ts,js}",
      ),
    );
  return t;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("SCOUT_EMAIL_ENABLED", "true");
  vi.stubEnv("AGENTMAIL_INBOX_ID", "shared@agentmail.to");
  vi.stubEnv("AGENTMAIL_API_KEY", "test-only-no-network");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function user(t: ReturnType<typeof setup>) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "consenting@example.com",
    });
    const p = {
      userId,
      email: "consenting@example.com",
      skills: ["TypeScript"],
      location: "India",
      hours: 12,
      solo: true,
      goal: "learn" as const,
      digestEnabled: true,
      nextDigestAt: now,
      consentVersion: 1,
    };
    const profileId = await ctx.db.insert("profiles", p);
    return { userId, profileId, p };
  });
}
it("generation failure remains retryable after nextDigestAt advances; duplicate schedules don't duplicate", async () => {
  const t = setup(true),
    u = await user(t);
  await t.mutation(internal.email.schedule, {});
  await t.mutation(internal.email.schedule, {});
  await t.action(internal.email.compose, {
    userId: u.userId,
    period: digestPeriod(now),
  });
  const rows = await t.run((ctx) => ctx.db.query("deliveries").take(10));
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("retryable");
  expect(rows[0].retryAt).toBe(now + 60000);
  expect((await t.run((ctx) => ctx.db.get(u.profileId)))?.nextDigestAt).toBe(
    now + WEEK,
  );
  vi.setSystemTime(now + 60000);
  await t.mutation(internal.email.recover, {});
  expect(
    await t.mutation(internal.email.claim, {
      userId: u.userId,
      period: rows[0].period,
    }),
  ).toBe(2);
});
it("recovers crashed leases and stops after three failures", async () => {
  const t = setup(),
    u = await user(t);
  await t.mutation(internal.email.schedule, {});
  const args = { userId: u.userId, period: digestPeriod(now) };
  for (let attempt = 1; attempt <= 3; attempt++) {
    expect(await t.mutation(internal.email.claim, args)).toBe(attempt);
    expect(await t.mutation(internal.email.claim, args)).toBeNull();
    await t.mutation(internal.email.failed, { ...args, attempt });
    vi.setSystemTime(now + attempt * 600000);
  }
  expect(
    (await t.run((ctx) => ctx.db.query("deliveries").first()))?.status,
  ).toBe("failed");
});
async function queued(t: ReturnType<typeof setup>) {
  const u = await user(t);
  const id = await t.mutation(internal.board.upsert, fixture);
  const o = (await t.run((ctx) => ctx.db.get(id)))!;
  await t.mutation(internal.email.schedule, {});
  const period = digestPeriod(now);
  const attempt = (await t.mutation(internal.email.claim, {
    userId: u.userId,
    period,
  }))!;
  const packet = {
    body: "A personalized fixture shortlist",
    checks: [{ id, fingerprint: decisionFingerprint(o) }],
    profileKey: profileKey(u.p),
  };
  await t.mutation(internal.email.enqueue, {
    userId: u.userId,
    period,
    attempt,
    packet,
  });
  const d = (await t.run((ctx) => ctx.db.query("deliveries").first()))!;
  return { ...u, d, id, packet };
}
it("unsubscribe defeats queued send and resubscribe cannot revive it", async () => {
  const t = setup(),
    u = await queued(t);
  expect(
    await t.query(internal.email.sendGuard, { outboundId: u.d.outboundId! }),
  ).toBe(true);
  const signed = t.withIdentity({ subject: u.userId });
  await signed.mutation(api.profiles.save, {
    skills: u.p.skills,
    location: u.p.location,
    hours: 12,
    solo: true,
    goal: "learn",
    digestEnabled: false,
  });
  expect(
    await t.query(internal.email.sendGuard, { outboundId: u.d.outboundId! }),
  ).toBe(false);
  expect(
    (await t.run((ctx) => mail.status(ctx, u.d.outboundId as any)))?.status,
  ).toBe("failed");
  await signed.mutation(api.profiles.save, {
    skills: u.p.skills,
    location: u.p.location,
    hours: 12,
    solo: true,
    goal: "learn",
    digestEnabled: true,
  });
  expect(
    await t.query(internal.email.sendGuard, { outboundId: u.d.outboundId! }),
  ).toBe(false);
});
it("changed deadline or reward prevents a provider attempt", async () => {
  const t = setup(),
    u = await queued(t);
  await t.run((ctx) => ctx.db.patch(u.id, { deadline: now - 1 }));
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(
    await t.action(c.agentmail.lib.performSend, { outboundId: u.d.outboundId }),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
async function sent(t: ReturnType<typeof setup>) {
  const u = await queued(t);
  await t.mutation(c.agentmail.testSupport.accept, {
    outboundId: u.d.outboundId,
  });
  return u;
}
const message = {
  inbox_id: "shared@agentmail.to",
  message_id: "reply-one",
  thread_id: "scout-thread",
  in_reply_to: "digest-message",
  from: "consenting@example.com",
  extracted_text: "Only TypeScript projects",
};
it("duplicate reply is durable work, retries an AI failure and sends once", async () => {
  const t = setup(true),
    u = await sent(t);
  await t.mutation(internal.email.received, {
    message,
    thread: {},
    eventId: "e1",
  });
  await t.mutation(internal.email.received, {
    message,
    thread: {},
    eventId: "e1-repeat",
  });
  await t.action(internal.email.respond, {
    userId: u.userId,
    messageId: message.message_id,
    text: message.extracted_text,
  });
  let rows = await t.run((ctx) => ctx.db.query("replyEvents").take(10));
  expect(rows).toHaveLength(1);
  expect(rows[0].status).toBe("retryable");
  vi.setSystemTime(now + 60000);
  await t.mutation(internal.email.recover, {});
  const claim = await t.mutation(internal.email.claimReply, {
    userId: u.userId,
    messageId: message.message_id,
  });
  expect(claim?.attempt).toBe(2);
  const args = {
    userId: u.userId,
    messageId: message.message_id,
    attempt: 2,
    packet: u.packet,
  };
  await t.mutation(internal.email.reply, args);
  await t.mutation(internal.email.reply, args);
  rows = await t.run((ctx) => ctx.db.query("replyEvents").take(10));
  expect(rows[0].outboundId).toBeTruthy();
  expect(rows[0].status).toBe("queued");
  expect(
    await t.mutation(internal.email.claimReply, {
      userId: u.userId,
      messageId: message.message_id,
    }),
  ).toBeNull();
});
it("STOP does not need AI or enabled sending and cancels already queued mail", async () => {
  const t = setup(true),
    u = await sent(t);
  vi.stubEnv("SCOUT_EMAIL_ENABLED", "false");
  await t.mutation(internal.email.received, {
    message: { ...message, extracted_text: "STOP" },
    thread: {},
    eventId: "stop",
  });
  expect((await t.run((ctx) => ctx.db.get(u.profileId)))?.digestEnabled).toBe(
    false,
  );
  expect(
    (await t.run((ctx) => ctx.db.query("replyEvents").first()))?.status,
  ).toBe("cancelled");
});
it("does not process another shared-inbox project, sender, parent or inbox", async () => {
  const t = setup(),
    u = await sent(t);
  for (const changed of [
    { thread_id: "rentpilot-thread" },
    { inbox_id: "other@agentmail.to" },
    { from: "stranger@example.com" },
    { in_reply_to: "unrelated-message" },
  ])
    await t.mutation(internal.email.received, {
      message: { ...message, ...changed },
      thread: {},
      eventId: "bad",
    });
  expect(
    await t.run((ctx) => ctx.db.query("replyEvents").take(10)),
  ).toHaveLength(0);
  expect((await t.run((ctx) => ctx.db.get(u.profileId)))?.digestEnabled).toBe(
    true,
  );
});
it("provider retries use the same HTTP idempotency key and do not transmit the private guard", async () => {
  const t = setup(),
    u = await queued(t);
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(Error("Transient connection loss"))
    .mockResolvedValue(
      new Response(JSON.stringify({ message_id: "m", thread_id: "t" }), {
        headers: { "content-type": "application/json" },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    t.action(c.agentmail.lib.performSend, { outboundId: u.d.outboundId }),
  ).rejects.toThrow("Transient");
  await t.action(c.agentmail.lib.performSend, { outboundId: u.d.outboundId });
  const requests = fetch.mock.calls.map((x) => x[1]);
  expect(requests[0].headers["Idempotency-Key"]).toBe(
    requests[1].headers["Idempotency-Key"],
  );
  expect(requests[0].body).not.toContain("X-Scout-Guard");
  vi.unstubAllGlobals();
});
it("source aliases preserve conflicting facts and saves can be resolved then rolled back", async () => {
  const t = setup(),
    u = await user(t);
  const identity = {
    organizer: "Acme",
    edition: "2026",
    strongId: fixture.url,
    evidence: "Acme Build 2026",
    sourceUrl: fixture.url,
  };
  const a = await t.mutation(internal.board.upsert, { ...fixture, identity });
  const b = await t.mutation(internal.board.upsert, {
    ...fixture,
    url: "https://acme.com/build",
    deadline: now + 2 * 86400000,
    identity: { ...identity, sourceUrl: "https://acme.com/build" },
  });
  await t.run((ctx) =>
    ctx.db.insert("saved", { userId: u.userId, opportunityId: b }),
  );
  expect((await t.run((ctx) => ctx.db.get(b)))?.canonicalId).toBe(a);
  expect((await t.run((ctx) => ctx.db.get(a)))?.conflicts).toContain(
    "deadline",
  );
  const saved = await t
    .withIdentity({ subject: u.userId })
    .query(api.board.savedData, {});
  expect(saved.records[0]._id).toBe(a);
  const change = (await t.run((ctx) =>
    ctx.db.query("identityChanges").first(),
  ))!;
  await t.mutation(internal.identity.rollback, { changeId: change._id });
  expect((await t.run((ctx) => ctx.db.get(b)))?.canonicalId).toBeUndefined();
  expect(
    (await t.run((ctx) => ctx.db.query("saved").first()))?.opportunityId,
  ).toBe(b);
});
it("returns candidates beyond page one within a bounded database budget", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 280; i++)
      await ctx.db.insert("opportunities", {
        ...fixture,
        title: `Build ${i}`,
        validUntil: now + 3600000,
      });
  });
  const records = await t.query(internal.board.candidates, {});
  expect(records).toHaveLength(250);
});

it("measures candidate database usage independently of the UI page", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    for (let i = 0; i < 280; i++)
      await ctx.db.insert("opportunities", {
        ...fixture,
        title: `Build ${i}`,
        validUntil: now + 3600000,
      });
  });
  const metrics = await t.run(async (ctx) => {
    await ctx.runQuery(internal.board.candidates, {});
    return ctx.meta.getTransactionMetrics();
  });
  console.log("SCOUT_CANDIDATE_USAGE", JSON.stringify(metrics));
  expect(metrics.documentsRead.used).toBeLessThanOrEqual(250);
  expect(metrics.databaseQueries.used).toBe(1);
});
it("annual editions on the same URL retain separate immutable references", async () => {
  const t = setup();
  const a = await t.mutation(internal.board.upsert, fixture);
  vi.setSystemTime(now + 1);
  const b = await t.mutation(internal.board.upsert, {
    ...fixture,
    title: "Build 2027",
  });
  expect(a).not.toBe(b);
  expect((await t.run((ctx) => ctx.db.get(a)))?.title).toBe("Build 2026");
  expect((await t.run((ctx) => ctx.db.get(b)))?.canonicalId).toBeUndefined();
});
it("late generation cannot overwrite a newer attempt or a cancelled delivery", async () => {
  const t = setup(),
    u = await user(t);
  await t.mutation(internal.email.schedule, {});
  const args = { userId: u.userId, period: digestPeriod(now) };
  await t.mutation(internal.email.claim, args);
  await t.mutation(internal.email.failed, { ...args, attempt: 1 });
  vi.setSystemTime(now + 60000);
  await t.mutation(internal.email.claim, args);
  await t.mutation(internal.email.failed, { ...args, attempt: 1 });
  expect(
    (await t.run((ctx) => ctx.db.query("deliveries").first()))?.status,
  ).toBe("composing");
});

it("unsubscribe preserves an already accepted provider receipt", async () => {
  const t = setup(),
    u = await sent(t);
  await t.withIdentity({ subject: u.userId }).mutation(api.profiles.save, {
    skills: u.p.skills,
    location: u.p.location,
    hours: 12,
    solo: true,
    goal: "learn",
    digestEnabled: false,
  });
  expect((await t.run((ctx) => ctx.db.get(u.d._id)))?.status).toBe("sent");
});
it("recovery reconciles accepted mail before changed consent and terminates expired pending sends", async () => {
  const t = setup(),
    u = await sent(t);
  await t.run((ctx) => ctx.db.patch(u.profileId, { digestEnabled: false }));
  vi.setSystemTime(now + 60000);
  await t.mutation(internal.email.recover, {});
  expect((await t.run((ctx) => ctx.db.get(u.d._id)))?.status).toBe("sent");
  vi.setSystemTime(now);
  const t2 = setup(),
    pending = await queued(t2);
  vi.setSystemTime(now + 24 * 3600000);
  await t2.mutation(internal.email.recover, {});
  const row = await t2.run((ctx) => ctx.db.get(pending.d._id));
  expect(row?.status).toBe("failed");
  expect(row?.retryAt).toBeUndefined();
  expect(
    (await t2.run((ctx) => mail.status(ctx, pending.d.outboundId as any)))
      ?.status,
  ).toBe("failed");
});

it("operator digest uses normal durable period and requires opt-in", async () => {
  const t = setup(),
    u = await user(t);
  await t.run((ctx) => ctx.db.patch(u.profileId, { digestEnabled: false }));
  await expect(
    t.mutation(internal.email.requestCurrentDigest, { userId: u.userId }),
  ).rejects.toThrow("opted-in");
  await t.run((ctx) => ctx.db.patch(u.profileId, { digestEnabled: true }));
  const period = await t.mutation(internal.email.requestCurrentDigest, {
    userId: u.userId,
  });
  expect(
    await t.mutation(internal.email.requestCurrentDigest, { userId: u.userId }),
  ).toBe(period);
  expect(await t.run((ctx) => ctx.db.query("deliveries").take(5))).toHaveLength(
    1,
  );
});

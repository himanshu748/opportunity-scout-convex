import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.daily(
  "discover across the web",
  { hourUTC: 1, minuteUTC: 30 },
  internal.ingest.refresh,
  {},
);
crons.daily(
  "discover active DEV challenges",
  { hourUTC: 1, minuteUTC: 35 },
  internal.directorySources.syncDev,
  {},
);
crons.interval(
  "continue source verification",
  { hours: 1 },
  internal.ingest.drain,
  {},
);
crons.hourly(
  "dispatch due weekly digests",
  { minuteUTC: 23 },
  internal.email.schedule,
  {},
);
crons.interval(
  "check Scout digest replies",
  { minutes: 15 },
  internal.email.pollReplies,
  {},
);
crons.interval(
  "refresh shared discovery counts",
  { hours: 1 },
  internal.discovery.refreshStats,
  {},
);
crons.interval(
  "recover digest and reply work",
  { minutes: 5 },
  internal.email.recover,
  {},
);
export default crons;

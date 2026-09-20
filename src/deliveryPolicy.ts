export const WEEK = 7 * 86400000;
export const MAX_ATTEMPTS = 3;
export const LEASE = 10 * 60000;
export function digestPeriod(at: number) {
  return String(Math.floor(at / WEEK));
}
export function retryPlan(attempts: number, periodEnd: number, now: number) {
  const retryAt =
    now + Math.min(30 * 60000, 60000 * 2 ** Math.max(0, attempts - 1));
  return attempts < MAX_ATTEMPTS && retryAt < periodEnd
    ? { status: "retryable" as const, retryAt }
    : { status: "failed" as const, retryAt: undefined };
}
export function profileKey(p: {
  skills: string[];
  location: string;
  hours: number;
  solo: boolean;
  goal: string;
  email: string;
  digestEnabled: boolean;
  consentVersion?: number;
}) {
  return JSON.stringify([
    p.skills,
    p.location,
    p.hours,
    p.solo,
    p.goal,
    p.email,
    p.digestEnabled,
    p.consentVersion ?? 0,
  ]);
}
export function canClaim(
  row: {
    status?: string;
    attempts?: number;
    leaseUntil?: number;
    periodEnd?: number;
    outboundId?: string;
  },
  now: number,
) {
  return (
    !row.outboundId &&
    !["sent", "cancelled", "failed"].includes(row.status ?? "legacy") &&
    (row.attempts ?? 0) < MAX_ATTEMPTS &&
    (row.leaseUntil ?? 0) <= now &&
    (row.periodEnd ?? 0) > now
  );
}

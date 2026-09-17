import { useEffect, useLayoutEffect, useState } from "react";
import type { Opportunity } from "./matching";
import { isActiveOpportunity } from "./availability";
export type VisibleOpportunity = Opportunity & { departingAt?: number };
export function transitionOpportunities(
  previous: VisibleOpportunity[],
  incoming: Opportunity[],
  now: number,
): VisibleOpportunity[] {
  const active = incoming.filter((o) => isActiveOpportunity(o, now));
  const ids = new Set(active.map((o) => o._id));
  const departing = previous
    .filter(
      (o) =>
        !ids.has(o._id) &&
        o.deadline !== null &&
        o.deadline <= now &&
        (o.departingAt ? now - o.departingAt < 650 : now - o.deadline < 5000),
    )
    .map((o) => ({ ...o, departingAt: o.departingAt ?? now }));
  return [...active, ...departing];
}
export function useExpiringOpportunities(
  incoming: Opportunity[] | undefined,
  now: number,
) {
  const [visible, setVisible] = useState<VisibleOpportunity[]>([]);
  useLayoutEffect(() => {
    setVisible((previous) =>
      transitionOpportunities(previous, incoming ?? [], Date.now()),
    );
  }, [incoming, now]);
  useEffect(() => {
    if (!visible.some((o) => o.departingAt)) return;
    const timer = setTimeout(
      () => setVisible((previous) => previous.filter((o) => !o.departingAt)),
      650,
    );
    return () => clearTimeout(timer);
  }, [visible]);
  return visible;
}

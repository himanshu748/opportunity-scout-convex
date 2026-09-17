import type { Profile } from "./matching";
/** Convex query records contain metadata that must never enter mutation arguments. */
export function profileInput(profile: Profile, digestEnabled: boolean) {
  return {
    skills: profile.skills,
    location: profile.location,
    hours: profile.hours,
    solo: profile.solo,
    goal: profile.goal,
    digestEnabled,
  };
}

export function deadlineLabel(
  deadline: number | null,
  now: number,
  dateOnly?: string,
) {
  if (dateOnly) return `Closes ${dateOnly} · time unspecified`;
  if (deadline === null) return "Deadline not confirmed";
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (!seconds) return "Deadline reached";
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    rest = seconds % 60;
  return days
    ? `${days}d ${hours}h ${minutes}m left`
    : `${hours}h ${String(minutes).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s left`;
}

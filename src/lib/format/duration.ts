export function formatHoursShort(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(hours * 60);
  const hourValue = Math.floor(totalMinutes / 60);
  const minuteValue = totalMinutes % 60;

  if (hourValue === 0) {
    return `${minuteValue}m`;
  }

  if (minuteValue === 0) {
    return `${hourValue}h`;
  }

  return `${hourValue}h ${minuteValue}m`;
}

const BUFFER_HOURS = 2;

function parseTimeToHour(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let hour = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return hour;
}

export function isTimeBlocked(time: string, bookedTimes: string[]): boolean {
  const b = parseTimeToHour(time);
  if (b === -1) return false;
  for (const bt of bookedTimes) {
    const a = parseTimeToHour(bt);
    if (a !== -1 && Math.abs(a - b) < BUFFER_HOURS) return true;
  }
  return false;
}

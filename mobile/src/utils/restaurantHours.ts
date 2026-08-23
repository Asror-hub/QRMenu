export type RestaurantHourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  closed: boolean | null;
};

/** App stores Monday=0 … Sunday=6 (see settings DAYS). */
export function getAppDayOfWeek(date = new Date()) {
  const jsDay = date.getDay(); // Sunday=0
  return jsDay === 0 ? 6 : jsDay - 1;
}

function timeToMinutes(value: string | null | undefined) {
  const [hours, minutes] = String(value ?? "00:00")
    .slice(0, 5)
    .split(":")
    .map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

export function isRestaurantOpenNow(
  hours: RestaurantHourRow[] | null | undefined,
  now = new Date()
) {
  if (!hours?.length) return true;

  const day = getAppDayOfWeek(now);
  const entry = hours.find((row) => row.day_of_week === day);
  if (!entry || entry.closed) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  const open = timeToMinutes(entry.open_time ?? "09:00");
  const close = timeToMinutes(entry.close_time ?? "22:00");

  if (open === close) return true;
  if (close > open) return current >= open && current < close;
  // Overnight window (e.g. 22:00 – 02:00)
  return current >= open || current < close;
}

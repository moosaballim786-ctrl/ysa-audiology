import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const TZ = "Africa/Johannesburg";

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
const zarCompact = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export function money(v: number | string | null | undefined) {
  return zar.format(Number(v ?? 0));
}
export function moneyShort(v: number | string | null | undefined) {
  return zarCompact.format(Number(v ?? 0));
}

/** Today's date in SAST as yyyy-MM-dd */
export function todayISO(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

/** Format a timestamp (ISO string or Date) in SAST */
export function fmtTZ(d: string | Date, pattern: string) {
  return formatInTimeZone(typeof d === "string" ? new Date(d) : d, TZ, pattern);
}

/** Format a plain date (yyyy-MM-dd) without timezone drift */
export function fmtDate(d: string | null | undefined, pattern = "d MMM yyyy") {
  if (!d) return "—";
  return formatInTimeZone(fromZonedTime(`${d.slice(0, 10)}T12:00:00`, TZ), TZ, pattern);
}

/** Convert a SAST local date + time (HH:mm) into a UTC ISO string */
export function sastToUtcISO(date: string, time: string) {
  return fromZonedTime(`${date}T${time.length === 5 ? time + ":00" : time}`, TZ).toISOString();
}

/** SAST date (yyyy-MM-dd) of a timestamp */
export function sastDate(ts: string | Date) {
  return formatInTimeZone(typeof ts === "string" ? new Date(ts) : ts, TZ, "yyyy-MM-dd");
}

export function sastTime(ts: string | Date) {
  return formatInTimeZone(typeof ts === "string" ? new Date(ts) : ts, TZ, "HH:mm");
}

export function addDaysISO(date: string, n: number) {
  return formatInTimeZone(addDays(fromZonedTime(`${date}T12:00:00`, TZ), n), TZ, "yyyy-MM-dd");
}

export function daysUntil(date: string) {
  return differenceInCalendarDays(parseISO(date), parseISO(todayISO()));
}

export function zonedNow() {
  return toZonedTime(new Date(), TZ);
}

/** Normalise a South African phone number to E.164 (+27…). Returns null if invalid. */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("0")) s = "+27" + s.slice(1);
  else if (s.startsWith("27")) s = "+" + s;
  else if (!s.startsWith("+")) s = "+27" + s;
  return /^\+\d{9,15}$/.test(s) ? s : null;
}

/** Pretty-print +27821234567 → 082 123 4567 */
export function prettyPhone(e164: string | null | undefined) {
  if (!e164) return "—";
  if (e164.startsWith("+27") && e164.length === 12) {
    const n = "0" + e164.slice(3);
    return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e164;
}

export function greetingDate() {
  return formatInTimeZone(new Date(), TZ, "EEEE, d MMMM yyyy");
}

export function minutesToLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

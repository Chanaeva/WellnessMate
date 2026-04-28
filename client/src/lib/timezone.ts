/**
 * The database stores timestamps as "timestamp without time zone" (UTC values,
 * no Z suffix in JSON). JavaScript's Date constructor treats strings without a
 * timezone designator as *local* time, which causes a wrong offset. We append
 * "Z" whenever the string has no timezone info so the Date is always parsed as
 * UTC, then let the browser convert to its local timezone for display.
 */
function toUtcDate(date: Date | string): Date {
  if (date instanceof Date) return date;
  // If already has timezone info (Z or +/-offset), parse as-is
  if (/Z$|[+-]\d{2}:\d{2}$/.test(date)) return new Date(date);
  // No timezone info — treat as UTC by appending Z
  return new Date(date + "Z");
}

export function formatTimeLocal(date: Date | string): string {
  return toUtcDate(date).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateLocal(date: Date | string): string {
  return toUtcDate(date).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDateLongLocal(date: Date | string): string {
  return toUtcDate(date).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTimeLocal(date: Date | string): string {
  const d = toUtcDate(date);
  return `${formatDateLongLocal(d)} at ${formatTimeLocal(d)}`;
}

export function formatISODateLocal(date: Date | string): string {
  return toUtcDate(date).toLocaleDateString("en-CA");
}

export function formatTime24Local(date: Date | string): string {
  return toUtcDate(date).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Legacy aliases so existing imports compile without changes
export const formatTimeCST = formatTimeLocal;
export const formatDateCST = formatDateLocal;
export const formatDateLongCST = formatDateLongLocal;
export const formatDateTimeCST = formatDateTimeLocal;
export const formatISODateCST = formatISODateLocal;
export const formatTime24CST = formatTime24Local;

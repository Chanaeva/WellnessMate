const BUSINESS_TZ = "America/Chicago";

export function formatTimeCST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateCST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDateLongCST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTimeCST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = formatDateLongCST(d);
  const timePart = formatTimeCST(d);
  return `${datePart} at ${timePart}`;
}

export function formatISODateCST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}

export function formatTime24CST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

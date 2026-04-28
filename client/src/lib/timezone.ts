export function formatTimeLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDateLongLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTimeLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const datePart = formatDateLongLocal(d);
  const timePart = formatTimeLocal(d);
  return `${datePart} at ${timePart}`;
}

export function formatISODateLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-CA");
}

export function formatTime24Local(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Legacy aliases kept so existing imports compile without changes
export const formatTimeCST = formatTimeLocal;
export const formatDateCST = formatDateLocal;
export const formatDateLongCST = formatDateLongLocal;
export const formatDateTimeCST = formatDateTimeLocal;
export const formatISODateCST = formatISODateLocal;
export const formatTime24CST = formatTime24Local;

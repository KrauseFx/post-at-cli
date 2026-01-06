import type { SendungDetail, SendungSummary } from "./api.js";

export function formatEstimatedDelivery(delivery?: {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}): string {
  if (!delivery?.startDate && !delivery?.endDate) {
    return "—";
  }
  const datePart = delivery.endDate && delivery.endDate !== delivery.startDate
    ? `${delivery.startDate ?? ""} – ${delivery.endDate}`
    : delivery.startDate ?? delivery.endDate ?? "";

  const timePart = delivery.startTime
    ? delivery.endTime
      ? `${delivery.startTime} – ${delivery.endTime}`
      : delivery.startTime
    : "";

  return timePart ? `${datePart} (${timePart})` : datePart;
}

export function formatSendungList(items: SendungSummary[]): string {
  if (items.length === 0) {
    return "No deliveries found.";
  }
  return items
    .map(item => {
      const expected = formatEstimatedDelivery(item.estimatedDelivery);
      const sender = item.sender ? `from ${item.sender}` : "";
      const status = item.status ? `status=${item.status}` : "";
      const details = [sender, status].filter(Boolean).join(" ");
      return `${item.sendungsnummer}  ${expected}${details ? "  " + details : ""}`;
    })
    .join("\n");
}

export function extractPictureUrl(detail: SendungDetail): string | null {
  const bild = detail.bild as any;
  if (!bild) return null;
  if (typeof bild === "string") return bild;
  if (typeof bild === "object") {
    return bild.url || bild.src || null;
  }
  return null;
}

export function getViennaToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date());
}

export function isUpcoming(item: SendungSummary): boolean {
  const today = getViennaToday();
  const start = item.estimatedDelivery?.startDate;
  const end = item.estimatedDelivery?.endDate;
  if (end && end >= today) return true;
  if (start && start >= today) return true;
  return !start && !end;
}

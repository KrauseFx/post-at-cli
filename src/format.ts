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

const STATUS_LABELS: Record<string, string> = {
  ZU: "Zugestellt",
  ZUGESTELLT: "Zugestellt",
  IV: "In Verteilung",
  AV: "Avisiert",
  RE: "Retour",
  RUECKSENDUNG: "Ruecksendung"
};

export function isDeliveredStatus(status?: string): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return normalized === "ZU" || normalized === "ZUGESTELLT";
}

export function formatStatus(status?: string): string {
  if (!status) return "unknown";
  const key = status.toUpperCase();
  const label = STATUS_LABELS[key];
  return label ? `${status} (${label})` : status;
}

export function formatSendungList(items: SendungSummary[]): string {
  if (items.length === 0) {
    return "No deliveries found.";
  }
  return items
    .map(item => {
      const expected = formatEstimatedDelivery(item.estimatedDelivery);
      const sender = item.sender ? `from ${item.sender}` : "";
      const status = item.status ? `status=${formatStatus(item.status)}` : "status=unknown";
      const delivered = isDeliveredStatus(item.status) ? "delivered" : "in progress";
      const eta = expected ? `ETA: ${expected}` : "ETA: —";
      const details = [eta, status, delivered, sender].filter(Boolean).join("  ");
      return `${item.sendungsnummer}  ${details}`;
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

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

  const grouped = new Map<string, SendungSummary[]>();
  for (const item of items) {
    const key = item.status ? item.status.toUpperCase() : "UNKNOWN";
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const sortKey = (item: SendungSummary): number => {
    const delivery = item.estimatedDelivery;
    const date = delivery?.startDate || delivery?.endDate;
    if (!date) return Number.POSITIVE_INFINITY;
    const hasTime = date.includes("T");
    const time = delivery?.startTime || "";
    const iso = hasTime ? date : `${date}T${time || "00:00:00"}`;
    const ts = Date.parse(iso);
    return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
  };

  const groupKeys = Array.from(grouped.keys()).sort((a, b) => {
    const deliveredA = isDeliveredStatus(a) ? 1 : 0;
    const deliveredB = isDeliveredStatus(b) ? 1 : 0;
    if (deliveredA !== deliveredB) return deliveredA - deliveredB;
    const labelA = formatStatus(a);
    const labelB = formatStatus(b);
    return labelA.localeCompare(labelB);
  });

  const lines: string[] = [];
  for (const key of groupKeys) {
    const group = grouped.get(key) ?? [];
    const label = key === "UNKNOWN" ? "unknown" : formatStatus(key);
    const delivered = isDeliveredStatus(key) ? "delivered" : "in progress";
    lines.push(`Status: ${label} (${delivered})`);

    group.sort((a, b) => sortKey(a) - sortKey(b));
    for (const item of group) {
      const expected = formatEstimatedDelivery(item.estimatedDelivery);
      const sender = item.sender ? `from ${item.sender}` : "";
      const eta = expected ? `ETA: ${expected}` : "ETA: —";
      const details = [eta, sender].filter(Boolean).join("  ");
      lines.push(`  ${item.sendungsnummer}  ${details}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
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

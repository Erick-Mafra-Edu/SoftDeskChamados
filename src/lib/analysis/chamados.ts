import type { Chamado } from "@/types/softdesk";

const STATUS_KEYS = ["ds_status", "ds_status_chamado", "status"] as const;
const PRIORITY_KEYS = ["ds_prioridade", "prioridade", "ds_prioridade_chamado"] as const;
const DATE_KEYS = ["da_chamado", "dt_chamado", "dt_abertura", "data_abertura"] as const;
const ATTACHMENT_KEYS = [
  "nr_anexo",
  "qtd_anexo",
  "qt_anexo",
  "nr_anexos",
  "qtd_anexos",
  "total_anexos",
] as const;
const INTERACTION_KEYS = [
  "qtd_interacoes",
  "qt_interacoes",
  "nr_interacoes",
  "qtd_interacao",
  "qt_interacao",
  "nr_interacao",
  "total_interacoes",
] as const;
const SHARED_KEYS = [
  "flag_encaminhado",
  "fl_encaminhado",
  "flag_compartilhado",
  "encaminhado",
] as const;

type SummaryPoint = {
  name: string;
  value: number;
};

type TimelinePoint = {
  label: string;
  value: number;
};

type DashboardMetrics = {
  totalAttachments: number | null;
  withInteraction: number | null;
  sharedWithYou: number | null;
};

type TimelineRow = {
  sortKey: string;
  label: string;
  value: number;
};

export function buildStatusSummary(items: Chamado[]): SummaryPoint[] {
  return summarizeBy(items, "status", "Sem status");
}

export function buildPrioritySummary(items: Chamado[]): SummaryPoint[] {
  return summarizeBy(items, "priority", "Sem prioridade");
}

export function buildMonthlyTimeline(items: Chamado[]): TimelinePoint[] {
  const counts = new Map<string, TimelineRow>();

  for (const row of chamadosRows(items)) {
    const current = counts.get(row.monthKey);
    if (current) {
      current.value += 1;
      continue;
    }

    counts.set(row.monthKey, {
      sortKey: row.monthKey,
      label: row.monthLabel,
      value: 1,
    });
  }

  return Array.from(counts.values())
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map((row) => ({
      label: row.label,
      value: row.value,
    }));
}

export function buildDashboardMetrics(items: Chamado[]): DashboardMetrics {
  const rows = items.map((item) => ({
    attachments: readNumber(item, ATTACHMENT_KEYS),
    interactions: readNumber(item, INTERACTION_KEYS),
    shared: readNumber(item, SHARED_KEYS),
  }));

  const attachmentRows = rows.filter((row) => row.attachments !== null);
  const interactionRows = rows.filter((row) => row.interactions !== null);
  const sharedRows = rows.filter((row) => row.shared !== null);

  return {
    totalAttachments:
      attachmentRows.length > 0
        ? attachmentRows.reduce((sum, row) => sum + Number(row.attachments ?? 0), 0)
        : null,
    withInteraction:
      interactionRows.length > 0
        ? interactionRows.filter((row) => Number(row.interactions ?? 0) > 0).length
        : null,
    sharedWithYou:
      sharedRows.length > 0
        ? sharedRows.filter((row) => Number(row.shared ?? 0) === 1).length
        : null,
  };
}

export function getChamadoInsight(item: Chamado) {
  return {
    interactions: readNumber(item, INTERACTION_KEYS),
    attachments: readNumber(item, ATTACHMENT_KEYS),
    sharedWithYou: readNumber(item, SHARED_KEYS) === 1,
  };
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function summarizeBy(
  items: Chamado[],
  field: "status" | "priority",
  fallbackLabel: string,
): SummaryPoint[] {
  const counts = new Map<string, number>();

  for (const row of chamadosRows(items)) {
    const label = row[field] || fallbackLabel;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name));
}

function chamadosRows(items: Chamado[]) {
  return items.map((item) => {
    const status = readString(item, STATUS_KEYS) ?? "Sem status";
    const priority = readString(item, PRIORITY_KEYS) ?? "Sem prioridade";
    const dateValue = readString(item, DATE_KEYS) ?? "";
    const [year = "", month = ""] = dateValue.split("-");
    const hasMonth = year && month;

    return {
      status,
      priority,
      monthKey: hasMonth ? `${year}-${month}` : "9999-99",
      monthLabel: hasMonth ? `${month}/${year}` : "Sem data",
    };
  });
}

function readString(item: Chamado, keys: readonly string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readNumber(item: Chamado, keys: readonly string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

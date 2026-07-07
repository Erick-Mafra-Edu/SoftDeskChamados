import type { Chamado } from "@/types/softdesk";

export type DashboardViewMode = "table" | "kanban";

export type KanbanGroupField =
  | "status"
  | "priority"
  | "attendant"
  | "group"
  | "service"
  | "client";

export type KanbanCustomColumn = {
  id: string;
  label: string;
  matchValue: string;
};

export type KanbanConfig = {
  groupBy: KanbanGroupField;
  visibleColumns: string[];
  showOtherColumn: boolean;
  customColumns: KanbanCustomColumn[];
  itemOverrides: Record<string, string>;
};

export type DashboardPersistedState = {
  version: 3;
  items: Chamado[];
  source: "softdesk" | "mock";
  warning: string | null;
  searchText: string;
  viewMode: DashboardViewMode;
  kanban: KanbanConfig;
  updatedAt: string;
};

export interface DashboardStateAdapter {
  read(): DashboardPersistedState | null;
  write(state: DashboardPersistedState): void;
  clear(): void;
}

const STORAGE_KEY = "softdesk-dashboard-state";

export function createDefaultKanbanConfig(): KanbanConfig {
  return {
    groupBy: "status",
    visibleColumns: [],
    showOtherColumn: true,
    customColumns: [],
    itemOverrides: {},
  };
}

export function createBrowserDashboardStateAdapter(
  storageKey = STORAGE_KEY,
): DashboardStateAdapter {
  return {
    read() {
      if (typeof window === "undefined") {
        return null;
      }

      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw) as unknown;
        return isDashboardPersistedState(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    write(state) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(storageKey, JSON.stringify(state));
    },
    clear() {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(storageKey);
    },
  };
}

function isDashboardPersistedState(value: unknown): value is DashboardPersistedState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 3 &&
    Array.isArray(value.items) &&
    (value.source === "softdesk" || value.source === "mock") &&
    (typeof value.warning === "string" || value.warning === null) &&
    typeof value.searchText === "string" &&
    (value.viewMode === "table" || value.viewMode === "kanban") &&
    isKanbanConfig(value.kanban) &&
    typeof value.updatedAt === "string"
  );
}

function isKanbanConfig(value: unknown): value is KanbanConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isKanbanGroupField(value.groupBy) &&
    Array.isArray(value.visibleColumns) &&
    value.visibleColumns.every((column) => typeof column === "string") &&
    typeof value.showOtherColumn === "boolean" &&
    Array.isArray(value.customColumns) &&
    value.customColumns.every(isKanbanCustomColumn) &&
    isStringRecord(value.itemOverrides)
  );
}

function isKanbanCustomColumn(value: unknown): value is KanbanCustomColumn {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.matchValue === "string"
  );
}

function isKanbanGroupField(value: unknown): value is KanbanGroupField {
  return (
    value === "status" ||
    value === "priority" ||
    value === "attendant" ||
    value === "group" ||
    value === "service" ||
    value === "client"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

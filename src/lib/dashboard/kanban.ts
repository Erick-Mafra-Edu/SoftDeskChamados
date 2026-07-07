import type { Chamado } from "@/types/softdesk";
import type {
  KanbanConfig,
  KanbanCustomColumn,
  KanbanGroupField,
} from "@/lib/dashboard/storage";

export type KanbanGroupOption = {
  value: string;
  label: string;
  count: number;
};

export type KanbanColumn = {
  id: string;
  label: string;
  matchValue: string;
  items: Chamado[];
};

export const KANBAN_EMPTY_VALUE = "__EMPTY__";

const EMPTY_LABEL = "Sem classificacao";

export const KANBAN_GROUP_FIELD_OPTIONS: Array<{
  value: KanbanGroupField;
  label: string;
}> = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Prioridade" },
  { value: "attendant", label: "Atendente" },
  { value: "group", label: "Grupo de solucao" },
  { value: "service", label: "Servico" },
  { value: "client", label: "Cliente" },
];

export function getKanbanGroupOptions(
  items: Chamado[],
  configOrGroupBy: KanbanConfig | KanbanGroupField,
): KanbanGroupOption[] {
  const groupBy =
    typeof configOrGroupBy === "string" ? configOrGroupBy : configOrGroupBy.groupBy;
  const itemOverrides =
    typeof configOrGroupBy === "string" ? {} : configOrGroupBy.itemOverrides;
  const counts = new Map<string, KanbanGroupOption>();

  for (const item of items) {
    const value = getKanbanGroupValue(item, groupBy, itemOverrides);
    const label = getKanbanGroupLabel(item, groupBy, itemOverrides);
    const existing = counts.get(value);

    if (existing) {
      existing.count += 1;
      continue;
    }

    counts.set(value, { value, label, count: 1 });
  }

  return Array.from(counts.values()).sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label),
  );
}

export function normalizeKanbanConfig(
  items: Chamado[],
  config: KanbanConfig,
): KanbanConfig {
  const options = getKanbanGroupOptions(items, config.groupBy);
  const customColumns = normalizeCustomColumns(config.customColumns);
  const validValues = new Set([
    ...options.map((option) => option.value),
    ...customColumns.map((column) => column.id),
  ]);
  const visibleColumns = dedupeStrings(config.visibleColumns).filter((value) => validValues.has(value));

  if (visibleColumns.length > 0 || config.visibleColumns.length === 0) {
    return {
      ...config,
      customColumns,
      visibleColumns,
    };
  }

  return {
    ...config,
    customColumns,
    visibleColumns: options.slice(0, 6).map((option) => option.value),
  };
}

export function createKanbanConfigForGroup(
  items: Chamado[],
  groupBy: KanbanGroupField,
): KanbanConfig {
  return normalizeKanbanConfig(items, {
    groupBy,
    visibleColumns: [],
    showOtherColumn: true,
    customColumns: [],
    itemOverrides: {},
  });
}

export function buildKanbanColumns(items: Chamado[], config: KanbanConfig): KanbanColumn[] {
  const normalizedConfig = normalizeKanbanConfig(items, config);
  const resolvedColumns = normalizedConfig.visibleColumns.map((columnId) =>
    resolveColumnDefinition(
      items,
      normalizedConfig.groupBy,
      normalizedConfig.customColumns,
      columnId,
    ),
  );
  const knownColumns = new Map<string, Chamado[]>();

  for (const column of resolvedColumns) {
    knownColumns.set(column.id, []);
  }

  const otherItems: Chamado[] = [];

  for (const item of items) {
    const value = getKanbanGroupValue(
      item,
      normalizedConfig.groupBy,
      normalizedConfig.itemOverrides,
    );
    const targetColumn = resolvedColumns.find((column) => column.matchValue === value);
    const bucket = targetColumn ? knownColumns.get(targetColumn.id) : null;

    if (bucket) {
      bucket.push(item);
      continue;
    }

    otherItems.push(item);
  }

  const columns = resolvedColumns.map((column) => ({
    id: column.id,
    label: column.label,
    matchValue: column.matchValue,
    items: knownColumns.get(column.id) ?? [],
  }));

  if (normalizedConfig.showOtherColumn) {
    columns.push({
      id: "__OTHER__",
      label: "Outros",
      matchValue: "__OTHER__",
      items: otherItems,
    });
  }

  return columns;
}

export function getKanbanGroupLabel(
  item: Chamado,
  groupBy: KanbanGroupField,
  itemOverrides: Record<string, string> = {},
) {
  const raw = getEffectiveKanbanValue(item, groupBy, itemOverrides);
  return raw || EMPTY_LABEL;
}

export function getKanbanGroupValue(
  item: Chamado,
  groupBy: KanbanGroupField,
  itemOverrides: Record<string, string> = {},
) {
  const raw = getEffectiveKanbanValue(item, groupBy, itemOverrides);
  return raw || KANBAN_EMPTY_VALUE;
}

function getOptionLabel(items: Chamado[], groupBy: KanbanGroupField, value: string) {
  if (value === KANBAN_EMPTY_VALUE) {
    return EMPTY_LABEL;
  }

  const match = getKanbanGroupOptions(items, groupBy).find((option) => option.value === value);
  return match?.label ?? value;
}

function resolveColumnDefinition(
  items: Chamado[],
  groupBy: KanbanGroupField,
  customColumns: KanbanCustomColumn[],
  columnId: string,
) {
  const customColumn = customColumns.find((column) => column.id === columnId);
  if (customColumn) {
    return {
      id: customColumn.id,
      label: customColumn.label,
      matchValue: customColumn.matchValue,
    };
  }

  return {
    id: columnId,
    label: getOptionLabel(items, groupBy, columnId),
    matchValue: columnId,
  };
}

function readKanbanField(item: Chamado, groupBy: KanbanGroupField) {
  switch (groupBy) {
    case "status":
      return normalizeString(item.ds_status);
    case "priority":
      return normalizeString(item.ds_prioridade);
    case "attendant":
      return normalizeString(item.nm_atendente);
    case "group":
      return normalizeString(item.ds_grupo_solucao);
    case "service":
      return normalizeString(item.ds_servico);
    case "client":
      return normalizeString(item.nm_cliente);
    default:
      return null;
  }
}

function getEffectiveKanbanValue(
  item: Chamado,
  groupBy: KanbanGroupField,
  itemOverrides: Record<string, string>,
) {
  const override = itemOverrides[getKanbanOverrideKey(item.cd_chamado, groupBy)];
  if (override) {
    return override;
  }

  return readKanbanField(item, groupBy);
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function dedupeStrings(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function normalizeCustomColumns(columns: KanbanCustomColumn[]) {
  return columns.filter((column, index) => {
    const id = column.id.trim();
    const label = column.label.trim();
    const matchValue = column.matchValue.trim();

    if (!id || !label || !matchValue) {
      return false;
    }

    return columns.findIndex((item) => item.id === column.id) === index;
  });
}

export function getKanbanOverrideKey(cdChamado: number, groupBy: KanbanGroupField) {
  return `${groupBy}:${cdChamado}`;
}

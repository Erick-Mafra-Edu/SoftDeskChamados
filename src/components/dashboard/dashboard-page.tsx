"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Grid,
  Heading,
  Inset,
  ScrollArea,
  Select,
  Skeleton,
  Strong,
  Switch,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  AlertCircle,
  ArrowRightCircle,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  FileText,
  Filter,
  Info,
  LogIn,
  Link2,
  MessageSquareText,
  Eye,
  Paperclip,
  Pencil,
  PlayCircle,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";
import { EChartCard } from "@/components/dashboard/echart-card";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import type {
  Chamado,
  ChamadoDetailResponse,
  SoftdeskFolderResponse,
  SoftdeskFolderOption,
  ChamadoListResponse,
  SoftdeskFilterField,
  SoftdeskSearchFormResponse,
} from "@/types/softdesk";
import {
  buildDashboardMetrics,
  buildMonthlyTimeline,
  buildPrioritySummary,
  buildStatusSummary,
  formatDate,
  getChamadoInsight,
} from "@/lib/analysis/chamados";
import {
  createKanbanConfigForGroup,
  getKanbanGroupOptions,
  getKanbanOverrideKey,
  KANBAN_GROUP_FIELD_OPTIONS,
  normalizeKanbanConfig,
} from "@/lib/dashboard/kanban";
import {
  createBrowserDashboardStateAdapter,
  createDefaultKanbanConfig,
  type DashboardViewMode,
  type KanbanConfig,
  type KanbanCustomColumn,
  type KanbanGroupField,
} from "@/lib/dashboard/storage";

export function DashboardPage({
  initialItems,
  initialSource,
  initialWarning,
}: {
  initialItems: Chamado[];
  initialSource: "softdesk" | "mock";
  initialWarning: string | null;
}) {
  const [items, setItems] = useState<Chamado[]>(normalizeItems(initialItems));
  const [selected, setSelected] = useState<Chamado | null>(null);
  const [detail, setDetail] = useState<Chamado | null>(null);
  const [filter, setFilter] = useState("");
  const [source, setSource] = useState<"softdesk" | "mock">(initialSource);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [kanbanConfigOpen, setKanbanConfigOpen] = useState(false);
  const [kanbanFilterOpen, setKanbanFilterOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [attendantPickerOpen, setAttendantPickerOpen] = useState(false);
  const [ignoreNextFiltersClose, setIgnoreNextFiltersClose] = useState(false);
  const [filterFields, setFilterFields] = useState<SoftdeskFilterField[]>([]);
  const [folders, setFolders] = useState<SoftdeskFolderOption[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialWarning);
  const [browserLoginEnabled, setBrowserLoginEnabled] = useState(false);
  const [browserLoginLabel, setBrowserLoginLabel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DashboardViewMode>("table");
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [kanbanConfig, setKanbanConfig] = useState<KanbanConfig>(() =>
    createDefaultKanbanConfig(),
  );
  const [loginForm, setLoginForm] = useState<BrowserLoginState>(createEmptyBrowserLoginState);
  const [customColumnDraft, setCustomColumnDraft] = useState<CustomColumnDraftState>(
    createEmptyCustomColumnDraftState(),
  );
  const [kanbanFilters, setKanbanFilters] = useState<KanbanFiltersState>(
    createDefaultKanbanFilters(),
  );
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(
    createDefaultFilters(),
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const adapter = createBrowserDashboardStateAdapter();
    const persistedState = adapter.read();

    if (persistedState) {
      setItems(normalizeItems(persistedState.items));
      setSource(persistedState.source);
      setError(persistedState.warning);
      setFilter(persistedState.searchText);
      setViewMode(persistedState.viewMode);
      setKanbanConfig(persistedState.kanban);
    }

    const savedBrowserLogin = readBrowserLoginState();
    if (savedBrowserLogin) {
      setLoginForm(savedBrowserLogin);
      setBrowserLoginEnabled(true);
      setBrowserLoginLabel(savedBrowserLogin.username);
    }

    setStorageHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!storageHydrated || !browserLoginEnabled) {
      return;
    }

    void ensureSoftdeskSession();
  }, [browserLoginEnabled, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated) {
      return;
    }

    createBrowserDashboardStateAdapter().write({
      version: 3,
      items,
      source,
      warning: error,
      searchText: filter,
      viewMode,
      kanban: normalizeKanbanConfig(items, kanbanConfig),
      updatedAt: new Date().toISOString(),
    });
  }, [error, filter, items, kanbanConfig, source, storageHydrated, viewMode]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!storageHydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const demoView = params.get("view");
    const demoPanel = params.get("panel");

    if (demoView === "kanban") {
      setViewMode("kanban");
      setKanbanConfig((current) => {
        if (current.visibleColumns.length > 0 || items.length === 0) {
          return current;
        }

        return createKanbanConfigForGroup(items, current.groupBy);
      });
    } else if (demoView === "table") {
      setViewMode("table");
    }

    if (demoPanel === "filters") {
      setFiltersOpen(true);
      void loadFolders();
      void loadFilterFields();
    } else if (demoPanel === "kanban-config") {
      setKanbanConfigOpen(true);
    }
    // Demo query params are consumed once for screenshot automation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageHydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function closeStatusPickerKeepingFiltersOpen() {
    setIgnoreNextFiltersClose(true);
    setStatusPickerOpen(false);
    setFiltersOpen(true);
  }

  function closeGroupPickerKeepingFiltersOpen() {
    setIgnoreNextFiltersClose(true);
    setGroupPickerOpen(false);
    setFiltersOpen(true);
  }

  function closeAttendantPickerKeepingFiltersOpen() {
    setIgnoreNextFiltersClose(true);
    setAttendantPickerOpen(false);
    setFiltersOpen(true);
  }

  function activateKanbanView() {
    setViewMode("kanban");
    setKanbanConfig((current) => {
      if (current.visibleColumns.length > 0 || items.length === 0) {
        return current;
      }

      return createKanbanConfigForGroup(items, current.groupBy);
    });
  }

  async function ensureSoftdeskSession(showFeedback = false) {
    const savedBrowserLogin = readBrowserLoginState();
    if (!savedBrowserLogin) {
      return false;
    }

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: savedBrowserLogin.username,
          password: savedBrowserLogin.password,
          userType: savedBrowserLogin.userType || "A",
        }),
      });

      const payload = (await response.json()) as {
        snapshot?: {
          authMode?: string;
        } | null;
      };

      if (!response.ok) {
        throw new Error("Falha ao autenticar com o login salvo no navegador.");
      }

      setBrowserLoginEnabled(true);
      setBrowserLoginLabel(savedBrowserLogin.username);

      if (showFeedback) {
        setError(
          `Login Softdesk ativo com ${savedBrowserLogin.username} (${payload.snapshot?.authMode ?? "login"}).`,
        );
      }

      return true;
    } catch (sessionError) {
      if (showFeedback) {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Erro ao autenticar com o login salvo.",
        );
      }

      return false;
    }
  }

  async function submitBrowserLogin() {
    setLoginLoading(true);

    try {
      const payload = {
        username: loginForm.username.trim(),
        password: loginForm.password,
        userType: loginForm.userType.trim() || "A",
      };

      if (!payload.username || !payload.password) {
        throw new Error("Informe usuario e senha para salvar o login no navegador.");
      }

      const response = await fetch("/api/session", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Falha ao autenticar no Softdesk com o usuario informado.");
      }

      const normalizedState: BrowserLoginState = {
        username: payload.username,
        password: payload.password,
        userType: payload.userType,
      };

      writeBrowserLoginState(normalizedState);
      setLoginForm(normalizedState);
      setBrowserLoginEnabled(true);
      setBrowserLoginLabel(normalizedState.username);
      setLoginOpen(false);
      setError(`Login salvo no navegador para ${normalizedState.username}.`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Erro ao salvar login.");
    } finally {
      setLoginLoading(false);
    }
  }

  function clearBrowserLogin() {
    clearBrowserLoginState();
    setBrowserLoginEnabled(false);
    setBrowserLoginLabel(null);
    setLoginForm(createEmptyBrowserLoginState());
    setError("Login salvo no navegador removido. O app voltou a usar o .env do servidor.");
  }

  function addCustomKanbanColumn() {
    const label = customColumnDraft.label.trim();
    const matchValue = customColumnDraft.matchValue.trim();

    if (!label || !matchValue) {
      setError("Informe um nome e um valor de correspondencia para a coluna customizada.");
      return;
    }

    const newColumn: KanbanCustomColumn = {
      id: `custom:${label.toLowerCase().replace(/\s+/g, "-")}:${matchValue.toLowerCase().replace(/\s+/g, "-")}`,
      label,
      matchValue,
    };

    setKanbanConfig((current) => {
      if (current.customColumns.some((column) => column.id === newColumn.id)) {
        return current;
      }

      return {
        ...current,
        customColumns: [...current.customColumns, newColumn],
        visibleColumns: [...current.visibleColumns, newColumn.id],
      };
    });
    setCustomColumnDraft(createEmptyCustomColumnDraftState());
  }

  function removeCustomKanbanColumn(columnId: string) {
    setKanbanConfig((current) => ({
      ...current,
      customColumns: current.customColumns.filter((column) => column.id !== columnId),
      visibleColumns: current.visibleColumns.filter((column) => column !== columnId),
    }));
  }

  function moveKanbanItem(item: Chamado, targetColumnId: string) {
    setKanbanConfig((current) => {
      const targetMatchValue =
        targetColumnId === "__OTHER__"
          ? ""
          : current.customColumns.find((column) => column.id === targetColumnId)?.matchValue ??
            targetColumnId;
      const overrideKey = getKanbanOverrideKey(item.cd_chamado, current.groupBy);
      const nextOverrides = { ...current.itemOverrides };

      if (!targetMatchValue) {
        delete nextOverrides[overrideKey];
      } else {
        nextOverrides[overrideKey] = targetMatchValue;
      }

      return {
        ...current,
        itemOverrides: nextOverrides,
      };
    });
  }

  function moveKanbanColumn(sourceColumnId: string, targetColumnId: string) {
    if (
      sourceColumnId === targetColumnId ||
      sourceColumnId === "__OTHER__" ||
      targetColumnId === "__OTHER__"
    ) {
      return;
    }

    setKanbanConfig((current) => {
      const nextVisibleColumns = [...current.visibleColumns];
      const sourceIndex = nextVisibleColumns.indexOf(sourceColumnId);
      const targetIndex = nextVisibleColumns.indexOf(targetColumnId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      const [movedColumn] = nextVisibleColumns.splice(sourceIndex, 1);
      nextVisibleColumns.splice(targetIndex, 0, movedColumn);

      return {
        ...current,
        visibleColumns: nextVisibleColumns,
      };
    });
  }

  async function loadChamados() {
    setLoading(true);
    setError(null);

    try {
      await ensureSoftdeskSession();
      const response = await fetch("/api/chamados?limit=80", { cache: "no-store" });
      const payload = (await response.json()) as ChamadoListResponse;

      if (!response.ok) {
        throw new Error("Falha ao carregar chamados.");
      }

      setItems(normalizeItems(payload.items));
      setSource(payload.source);
      setError(payload.warning ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFilterFields(areaOverride?: string) {
    setFiltersLoading(true);

    try {
      await ensureSoftdeskSession();
      const response = await fetch("/api/chamados/filtros", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cd_area: Number(areaOverride ?? advancedFilters.pesq_cd_area),
        }),
      });
      const payload = (await response.json()) as SoftdeskSearchFormResponse;

      if (!response.ok) {
        throw new Error("Falha ao carregar opcoes de filtros.");
      }

      setFilterFields(payload.fields ?? []);
      setSource(payload.source);
      if (typeof window !== "undefined") {
        console.group("Softdesk filtros debug");
        console.log("Resposta bruta do formulario:", payload.debug?.raw);
        console.log("Campos extraidos:", payload.debug?.extracted);
        console.log("Payload completo:", payload);
        console.groupEnd();
      }
      if (payload.warning) {
        setError(payload.warning);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Erro ao carregar filtros.",
      );
    } finally {
      setFiltersLoading(false);
    }
  }

  async function loadFolders() {
    try {
      await ensureSoftdeskSession();
      const response = await fetch("/api/chamados/pastas", {
        cache: "no-store",
      });
      const payload = (await response.json()) as SoftdeskFolderResponse;

      if (!response.ok) {
        throw new Error("Falha ao carregar pastas.");
      }

      setFolders(payload.folders ?? []);
      if (payload.warning) {
        setError(payload.warning);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar pastas.");
    }
  }

  async function applyAdvancedFilters() {
    setSearchLoading(true);
    setError(null);

    try {
      await ensureSoftdeskSession();
      const response = await fetch("/api/chamados/pesquisa", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...advancedFilters,
          limit: advancedFilters.limit_enabled ? advancedFilters.limit : null,
        }),
      });
      const payload = (await response.json()) as ChamadoListResponse;

      if (!response.ok) {
        throw new Error("Falha ao pesquisar chamados com filtros.");
      }

      setItems(normalizeItems(payload.items));
      setSelected(null);
      setDetail(null);
      setSource(payload.source);
      setError(payload.warning ?? null);
      setFiltersOpen(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Erro ao aplicar filtros.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function openDetail(chamado: Chamado) {
    setSelected(chamado);
    setDetail(chamado);
    setDetailLoading(true);

    try {
      await ensureSoftdeskSession();
      const response = await fetch(`/api/chamados/${chamado.cd_chamado}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ChamadoDetailResponse;

      if (!response.ok) {
        throw new Error("Falha ao carregar detalhe do chamado.");
      }

      setDetail(mergeChamadoDetail(chamado, payload.item));
      setError(payload.warning ?? null);
    } catch {
      setDetail(chamado);
    } finally {
      setDetailLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const normalized = filter.trim().toLowerCase();

    if (!normalized) {
      return normalizeItems(items);
    }

    return normalizeItems(items).filter((item) =>
      [
        item.tt_chamado,
        item.nm_cliente,
        item.nm_atendente,
        item.ds_status,
        String(item.cd_chamado),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [filter, items]);

  const metrics = buildDashboardMetrics(filteredItems);
  const statusSummary = buildStatusSummary(filteredItems);
  const prioritySummary = buildPrioritySummary(filteredItems);
  const timeline = buildMonthlyTimeline(filteredItems);
  const detailInsight = detail ? getChamadoInsight(detail) : null;
  const detailActivities = detail ? extractChamadoActivities(detail) : [];
  const initialMessage = detail ? extractInitialChamadoMessage(detail) : null;
  const effectiveKanbanConfig = useMemo(
    () => normalizeKanbanConfig(items, kanbanConfig),
    [items, kanbanConfig],
  );
  const kanbanVisibleItems = useMemo(
    () => applyKanbanFilters(filteredItems, kanbanFilters),
    [filteredItems, kanbanFilters],
  );
  const kanbanGroupOptions = useMemo(
    () => getKanbanGroupOptions(items, effectiveKanbanConfig.groupBy),
    [items, effectiveKanbanConfig.groupBy],
  );

  return (
    <Box className="app-shell">
      <Box px={{ initial: "4", md: "7" }} py={{ initial: "5", md: "7" }}>
        <Flex
          direction={{ initial: "column", md: "row" }}
          justify="between"
          gap="5"
          align={{ initial: "start", md: "end" }}
          mb="6"
        >
          <Box>
            <Badge radius="full" size="2" color="blue" variant="soft">
              PWA operacional
            </Badge>
            <Heading size="8" mt="3" style={{ letterSpacing: "-0.04em" }}>
              Painel de analise de chamados Softdesk
            </Heading>
            <Text size="3" color="gray" mt="2" as="p">
              Estrutura pronta para evoluir a sessao autenticada, novos endpoints e fluxos
              de triagem, com fallback local para desenvolvimento.
            </Text>
          </Box>

          <Flex direction="column" gap="3" style={{ minWidth: 320 }}>
            <Flex gap="3">
              <TextField.Root
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filtrar por titulo, cliente, status..."
                size="3"
                style={{ flex: 1 }}
              >
                <TextField.Slot>
                  <Filter width="18" height="18" />
                </TextField.Slot>
              </TextField.Root>
              <Button size="3" onClick={() => void loadChamados()}>
                <RefreshCw width="16" height="16" />
                Atualizar
              </Button>
              <Button size="3" variant="soft" onClick={() => setLoginOpen(true)}>
                <LogIn width="16" height="16" />
                Login
              </Button>
              <Button
                size="3"
                variant="soft"
                onClick={() => {
                  setFiltersOpen(true);
                  void loadFolders();
                  void loadFilterFields();
                }}
              >
                <Search width="16" height="16" />
                Filtros
              </Button>
            </Flex>
            <Flex gap="2" wrap="wrap">
              <Button
                size="2"
                variant={viewMode === "table" ? "solid" : "soft"}
                onClick={() => setViewMode("table")}
              >
                Tabela
              </Button>
              <Button
                size="2"
                variant={viewMode === "kanban" ? "solid" : "soft"}
                onClick={activateKanbanView}
              >
                Kanban
              </Button>
              <Button
                size="2"
                variant="soft"
                onClick={() => setKanbanConfigOpen(true)}
                disabled={items.length === 0}
              >
                Configurar kanban
              </Button>
            </Flex>
            <Flex gap="3" wrap="wrap">
              {browserLoginEnabled ? (
                <Badge color="blue" variant="soft">
                  Login browser: {browserLoginLabel ?? "ativo"}
                </Badge>
              ) : null}
              <Badge color={source === "softdesk" ? "green" : "orange"} variant="soft">
                Fonte: {source === "softdesk" ? "Softdesk" : "Mock local"}
              </Badge>
              <Badge color="gray" variant="soft">
                {filteredItems.length} chamados
              </Badge>
              {viewMode === "kanban" ? (
                <Badge color="blue" variant="soft">
                  Agrupando por {getKanbanFieldLabel(effectiveKanbanConfig.groupBy)}
                </Badge>
              ) : null}
              {viewMode === "kanban" && hasActiveKanbanFilters(kanbanFilters) ? (
                <Badge color="amber" variant="soft">
                  {kanbanVisibleItems.length} apos filtro do kanban
                </Badge>
              ) : null}
            </Flex>
          </Flex>
        </Flex>

        {error ? (
          <Callout.Root color="red" mb="5">
            <Callout.Icon>
              <AlertCircle width="18" height="18" />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        ) : null}

        <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="4" mb="6">
          <MetricCard
            icon={<Ticket width="18" height="18" />}
            label="Chamados visiveis"
            value={String(filteredItems.length)}
            tone="blue"
          />
          <MetricCard
            icon={<Clock3 width="18" height="18" />}
            label="Compartilhados com voce"
            value={formatMetricValue(metrics.sharedWithYou)}
            tone="amber"
          />
          <MetricCard
            icon={<Link2 width="18" height="18" />}
            label="Com interacoes"
            value={formatMetricValue(metrics.withInteraction)}
            tone="green"
          />
          <MetricCard
            icon={<ArrowUpRight width="18" height="18" />}
            label="Total de anexos"
            value={formatMetricValue(metrics.totalAttachments)}
            tone="cyan"
          />
        </Grid>

        <Grid columns={{ initial: "1", xl: "2" }} gap="5" mb="6">
          <EChartCard
            title="Distribuicao por status"
            subtitle="Visao imediata dos gargalos operacionais."
            option={{
              tooltip: { trigger: "item" },
              legend: { bottom: 0 },
              series: [
                {
                  type: "pie",
                  radius: ["40%", "72%"],
                  label: { formatter: "{b}\n{c}" },
                  data: statusSummary,
                },
              ],
            }}
          />
          <EChartCard
            title="Prioridades dominantes"
            subtitle="Ajuda a separar volume de risco."
            option={{
              tooltip: { trigger: "axis" },
              xAxis: {
                type: "category",
                data: prioritySummary.map((item) => item.name),
                axisLabel: { rotate: 20 },
              },
              yAxis: { type: "value" },
              series: [
                {
                  type: "bar",
                  data: prioritySummary.map((item) => item.value),
                  itemStyle: {
                    borderRadius: [10, 10, 0, 0],
                    color: "#1473e6",
                  },
                },
              ],
            }}
          />
        </Grid>

        <Grid columns={{ initial: "1", xl: "1fr 1.3fr" }} gap="5">
          <EChartCard
            title="Linha do tempo mensal"
            subtitle="Entrada de chamados por mes."
            option={{
              tooltip: { trigger: "axis" },
              xAxis: {
                type: "category",
                data: timeline.map((item) => item.label),
              },
              yAxis: { type: "value" },
              series: [
                {
                  type: "line",
                  smooth: true,
                  areaStyle: {
                    color: "rgba(20,115,230,0.14)",
                  },
                  lineStyle: {
                    width: 3,
                    color: "#0f4fb4",
                  },
                  symbolSize: 10,
                  data: timeline.map((item) => item.value),
                },
              ],
            }}
          />

          <Card size="4" className="glass-panel">
            <Flex justify="between" align="center" mb="4">
              <Box>
                <Heading size="5">
                  {viewMode === "kanban" ? "Fila em kanban" : "Fila detalhada"}
                </Heading>
                <Text size="2" color="gray">
                  {viewMode === "kanban"
                    ? "Agrupe por status, prioridade, atendente e outras tags salvas no navegador."
                    : "Clique em um chamado para abrir o detalhe."}
                </Text>
              </Box>
              {viewMode === "kanban" ? (
                <Flex gap="2">
                  <Button size="2" variant="soft" onClick={() => setKanbanFilterOpen(true)}>
                    <Filter width="14" height="14" />
                    Filtrar chamados
                  </Button>
                  <Button size="2" variant="soft" onClick={() => setKanbanConfigOpen(true)}>
                    Ajustar colunas
                  </Button>
                </Flex>
              ) : null}
            </Flex>

            {loading ? (
              <Box px="4" pb="4">
                <Flex direction="column" gap="3">
                  <Skeleton height="56px" />
                  <Skeleton height="56px" />
                  <Skeleton height="56px" />
                </Flex>
              </Box>
            ) : viewMode === "table" ? (
              <Inset side="x">
                <ScrollArea type="always" scrollbars="horizontal">
                  <Box px="4" pb="4">
                    <Table.Root variant="surface">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Titulo</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Cliente</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Atendente</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Data</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {filteredItems.map((item) => (
                          <Table.Row
                            key={item.cd_chamado}
                            onClick={() => void openDetail(item)}
                            style={{ cursor: "pointer" }}
                          >
                            <Table.RowHeaderCell>#{item.cd_chamado}</Table.RowHeaderCell>
                            <Table.Cell>{item.tt_chamado}</Table.Cell>
                            <Table.Cell>{item.nm_cliente}</Table.Cell>
                            <Table.Cell>
                              <Badge variant="soft" color="blue">
                                {item.ds_status}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>{item.nm_atendente ?? "-"}</Table.Cell>
                            <Table.Cell>{formatDate(item.da_chamado)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </ScrollArea>
              </Inset>
            ) : (
              <Inset side="x">
                <KanbanBoard
                  items={kanbanVisibleItems}
                  config={effectiveKanbanConfig}
                  onOpenDetail={(item) => void openDetail(item)}
                  onMoveItem={moveKanbanItem}
                  onMoveColumn={moveKanbanColumn}
                />
              </Inset>
            )}
          </Card>
        </Grid>
      </Box>

      <Dialog.Root open={kanbanFilterOpen} onOpenChange={setKanbanFilterOpen}>
        <Dialog.Content maxWidth="640px">
          <Dialog.Title>Filtro do kanban</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Filtra apenas os cards exibidos no kanban, sem alterar a busca global nem a API.
          </Dialog.Description>

          <Flex direction="column" gap="4">
            <Grid columns={{ initial: "1", md: "2" }} gap="3">
              <TextField.Root
                placeholder="Texto do chamado ou cliente"
                value={kanbanFilters.text}
                onChange={(event) =>
                  setKanbanFilters((current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
              />
              <TextField.Root
                placeholder="Status"
                value={kanbanFilters.status}
                onChange={(event) =>
                  setKanbanFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              />
              <TextField.Root
                placeholder="Prioridade"
                value={kanbanFilters.priority}
                onChange={(event) =>
                  setKanbanFilters((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
              />
              <TextField.Root
                placeholder="Atendente"
                value={kanbanFilters.attendant}
                onChange={(event) =>
                  setKanbanFilters((current) => ({
                    ...current,
                    attendant: event.target.value,
                  }))
                }
              />
            </Grid>

            <Card variant="surface">
              <Text size="2" color="gray">
                Resultado atual: {kanbanVisibleItems.length} chamados visiveis no kanban.
              </Text>
            </Card>
          </Flex>

          <Flex gap="3" mt="5" justify="between">
            <Button
              variant="soft"
              color="gray"
              onClick={() => setKanbanFilters(createDefaultKanbanFilters())}
            >
              Limpar filtro
            </Button>
            <Flex gap="3">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Fechar
                </Button>
              </Dialog.Close>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={loginOpen} onOpenChange={setLoginOpen}>
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>Login Softdesk</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Use este botao para trocar o usuario definido no `.env` por um login salvo no
            seu navegador.
          </Dialog.Description>

          <Flex direction="column" gap="4">
            <Callout.Root color="amber">
              <Callout.Icon>
                <AlertCircle width="18" height="18" />
              </Callout.Icon>
              <Callout.Text>
                Seu usuario e sua senha ficam guardados no `localStorage` deste browser
                para autenticar a API do Softdesk.
              </Callout.Text>
            </Callout.Root>

            <Box>
              <Text as="label" size="2" color="gray">
                Usuario
              </Text>
              <TextField.Root
                mt="2"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="usuario.softdesk"
              />
            </Box>

            <Box>
              <Text as="label" size="2" color="gray">
                Senha
              </Text>
              <TextField.Root
                mt="2"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Digite a senha"
              />
            </Box>

            <Box>
              <Text as="label" size="2" color="gray">
                Tipo de usuario
              </Text>
              <TextField.Root
                mt="2"
                value={loginForm.userType}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    userType: event.target.value,
                  }))
                }
                placeholder="A"
              />
            </Box>
          </Flex>

          <Flex gap="3" mt="5" justify="between">
            <Button
              variant="soft"
              color="gray"
              onClick={clearBrowserLogin}
              disabled={!browserLoginEnabled}
            >
              Limpar login salvo
            </Button>
            <Flex gap="3">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button onClick={() => void submitBrowserLogin()} disabled={loginLoading}>
                Entrar
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={kanbanConfigOpen} onOpenChange={setKanbanConfigOpen}>
        <Dialog.Content maxWidth="760px">
          <Dialog.Title>Configuracao do kanban</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Escolha o campo de agrupamento e quais colunas ficam visiveis. Essa
            configuracao e os chamados carregados ficam salvos no `localStorage`.
          </Dialog.Description>

          <Flex direction="column" gap="4">
            <Grid columns={{ initial: "1", md: "2" }} gap="4">
              <FilterSelect
                label="Agrupar por"
                value={effectiveKanbanConfig.groupBy}
                options={KANBAN_GROUP_FIELD_OPTIONS}
                onValueChange={(value) =>
                  setKanbanConfig(
                    createKanbanConfigForGroup(items, value as KanbanGroupField),
                  )
                }
              />
              <Card variant="surface">
                <Flex align="center" justify="between" gap="3" p="3">
                  <Box>
                    <Text size="2">Exibir coluna Outros</Text>
                    <Text as="p" size="1" color="gray">
                      Mantem os chamados fora das colunas selecionadas em um bucket auxiliar.
                    </Text>
                  </Box>
                  <Switch
                    checked={effectiveKanbanConfig.showOtherColumn}
                    onCheckedChange={(checked) =>
                      setKanbanConfig((current) => ({
                        ...current,
                        showOtherColumn: checked,
                      }))
                    }
                  />
                </Flex>
              </Card>
            </Grid>

            <Card variant="surface">
              <Flex justify="between" align="center" gap="3" mb="3">
                <Box>
                  <Heading size="4">Colunas visiveis</Heading>
                  <Text size="2" color="gray">
                    Selecione as tags que vao virar colunas do board. Depois voce pode
                    arrastar chamados entre colunas no kanban.
                  </Text>
                </Box>
                <Flex gap="2" wrap="wrap">
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() =>
                      setKanbanConfig((current) => ({
                        ...current,
                        visibleColumns: [
                          ...kanbanGroupOptions.map((option) => option.value),
                          ...current.customColumns.map((column) => column.id),
                        ],
                      }))
                    }
                  >
                    Todas
                  </Button>
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() =>
                      setKanbanConfig((current) => ({
                        ...current,
                        visibleColumns: kanbanGroupOptions
                          .slice(0, 6)
                          .map((option) => option.value),
                      }))
                    }
                  >
                    Top 6
                  </Button>
                  <Button
                    size="2"
                    variant="soft"
                    color="gray"
                    onClick={() =>
                      setKanbanConfig((current) => ({
                        ...current,
                        visibleColumns: [],
                      }))
                    }
                  >
                    Limpar
                  </Button>
                </Flex>
              </Flex>

              <ScrollArea
                type="always"
                scrollbars="vertical"
                style={{ maxHeight: 360, marginTop: 8 }}
              >
                <Flex direction="column" gap="2" pr="3">
                  {kanbanGroupOptions.length === 0 ? (
                    <Card variant="surface">
                      <Text size="2" color="gray">
                        Nenhuma tag disponivel para o agrupamento atual.
                      </Text>
                    </Card>
                  ) : (
                    kanbanGroupOptions.map((option) => (
                      <label key={`${option.value}::${option.label}`}>
                        <Flex
                          align="center"
                          justify="between"
                          gap="3"
                          p="2"
                          style={{
                            borderRadius: 12,
                            border: "1px solid var(--gray-a4)",
                          }}
                        >
                          <Flex align="center" gap="3">
                            <Checkbox
                              checked={effectiveKanbanConfig.visibleColumns.includes(
                                option.value,
                              )}
                              onCheckedChange={(checked) =>
                                setKanbanConfig((current) => ({
                                  ...current,
                                  visibleColumns: updateStringList(
                                    current.visibleColumns,
                                    option.value,
                                    checked === true,
                                  ),
                                }))
                              }
                            />
                            <Text size="2">{option.label}</Text>
                          </Flex>
                          <Badge variant="soft" color="gray">
                            {option.count}
                          </Badge>
                        </Flex>
                      </label>
                    ))
                  )}
                </Flex>
              </ScrollArea>
            </Card>

            <Card variant="surface">
              <Flex direction="column" gap="3">
                <Box>
                  <Heading size="4">Colunas customizadas</Heading>
                  <Text size="2" color="gray">
                    Crie colunas com nome proprio e um valor de correspondencia para agrupar.
                  </Text>
                </Box>

                <Grid columns={{ initial: "1", md: "1fr 1fr auto" }} gap="3">
                  <TextField.Root
                    placeholder="Nome da coluna"
                    value={customColumnDraft.label}
                    onChange={(event) =>
                      setCustomColumnDraft((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                  <TextField.Root
                    placeholder="Valor de correspondencia"
                    value={customColumnDraft.matchValue}
                    onChange={(event) =>
                      setCustomColumnDraft((current) => ({
                        ...current,
                        matchValue: event.target.value,
                      }))
                    }
                  />
                  <Button variant="soft" onClick={addCustomKanbanColumn}>
                    Adicionar
                  </Button>
                </Grid>

                <Flex direction="column" gap="2">
                  {effectiveKanbanConfig.customColumns.length === 0 ? (
                    <Card variant="surface">
                      <Text size="2" color="gray">
                        Nenhuma coluna customizada criada.
                      </Text>
                    </Card>
                  ) : (
                    effectiveKanbanConfig.customColumns.map((column) => (
                      <Card key={column.id} variant="surface">
                        <Flex align="center" justify="between" gap="3">
                          <Box>
                            <Text size="2" weight="bold">
                              {column.label}
                            </Text>
                            <Text as="p" size="1" color="gray">
                              Corresponde a: {column.matchValue}
                            </Text>
                          </Box>
                          <Button
                            size="2"
                            variant="soft"
                            color="red"
                            onClick={() => removeCustomKanbanColumn(column.id)}
                          >
                            Remover
                          </Button>
                        </Flex>
                      </Card>
                    ))
                  )}
                </Flex>
              </Flex>
            </Card>
          </Flex>

          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Fechar
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <Dialog.Content maxWidth="820px">
          <Dialog.Title>Detalhe do chamado</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Informacoes principais do chamado selecionado.
          </Dialog.Description>

          {detailLoading ? (
            <Flex direction="column" gap="3">
              <Skeleton height="64px" />
              <Skeleton height="160px" />
            </Flex>
          ) : detail ? (
            <Flex direction="column" gap="4">
              <Card variant="surface">
                <Flex direction="column" gap="2">
                  <Flex justify="between" gap="3" wrap="wrap">
                    <Heading size="5">
                      #{detail.cd_chamado} {detail.tt_chamado}
                    </Heading>
                    <Badge color="blue" variant="soft">
                      {detail.ds_status ?? "Sem status"}
                    </Badge>
                  </Flex>
                  <Text color="gray">
                    <Strong>Cliente:</Strong> {detail.nm_cliente ?? "-"} |{" "}
                    <Strong>Atendente:</Strong> {detail.nm_atendente ?? "-"}
                  </Text>
                </Flex>
              </Card>

              <Grid columns={{ initial: "1", md: "2" }} gap="3">
                <InfoBlock label="Grupo de solucao" value={detail.ds_grupo_solucao} />
                <InfoBlock label="Servico" value={detail.ds_servico} />
                <InfoBlock label="Prioridade" value={detail.ds_prioridade} />
                <InfoBlock label="Data de abertura" value={formatDate(detail.da_chamado)} />
                <InfoBlock
                  label="Interacoes"
                  value={formatOptionalNumber(detailInsight?.interactions)}
                />
                <InfoBlock
                  label="Anexos"
                  value={formatOptionalNumber(detailInsight?.attachments)}
                />
              </Grid>

              <Card variant="surface">
                <Flex direction="column" gap="2">
                  <Heading size="4">Mensagem inicial</Heading>
                  {initialMessage ? (
                    <Text size="2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                      {initialMessage}
                    </Text>
                  ) : (
                    <Text size="2" color="gray">
                      O detalhe nao trouxe a mensagem inicial do chamado.
                    </Text>
                  )}
                </Flex>
              </Card>

              <Card variant="surface">
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center" gap="3" wrap="wrap">
                    <Box>
                      <Heading size="4">Historico de atividades</Heading>
                      <Text size="2" color="gray">
                        Atividades e interacoes encontradas no payload de detalhe do chamado.
                      </Text>
                    </Box>
                    <Badge variant="soft" color="blue">
                      {detailActivities.length} registros
                    </Badge>
                  </Flex>

                  {detailActivities.length === 0 ? (
                    <Text size="2" color="gray">
                      Nenhuma atividade encontrada no detalhe retornado.
                    </Text>
                  ) : (
                    <ScrollArea
                      type="always"
                      scrollbars="vertical"
                      style={{ maxHeight: 320, marginTop: 4 }}
                    >
                      <Flex direction="column" gap="2" pr="3">
                        {detailActivities.map((activity) => (
                          <Card key={activity.key} variant="surface">
                            <Flex direction="column" gap="2">
                              <Flex justify="between" align="start" gap="3" wrap="wrap">
                                <Flex align="start" gap="3">
                                  <Box
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 34,
                                      height: 34,
                                      borderRadius: 999,
                                      background: "var(--accent-a3)",
                                      color: "var(--accent-11)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <ActivityIcon activity={activity} />
                                  </Box>
                                  <Box>
                                    <Text size="2" weight="bold">
                                      {activity.title}
                                    </Text>
                                    <Text size="1" color="gray">
                                      {activity.dateLabel}
                                      {activity.user ? ` | ${activity.user}` : ""}
                                    </Text>
                                  </Box>
                                </Flex>
                                <Flex gap="2" wrap="wrap">
                                  {activity.status ? (
                                    <Badge variant="soft" color="blue">
                                      {activity.status}
                                    </Badge>
                                  ) : null}
                                  {activity.typeCode ? (
                                    <Badge variant="soft" color="gray">
                                      Tipo {activity.typeCode}
                                    </Badge>
                                  ) : null}
                                  {activity.chargeable ? (
                                    <Badge variant="soft" color="amber">
                                      Cobravel
                                    </Badge>
                                  ) : null}
                                </Flex>
                              </Flex>
                              {activity.description ? (
                                <Text size="2" color="gray">
                                  {activity.description}
                                </Text>
                              ) : null}
                            </Flex>
                          </Card>
                        ))}
                      </Flex>
                    </ScrollArea>
                  )}
                </Flex>
              </Card>
            </Flex>
          ) : (
            <Text color="gray">Selecione um chamado para inspecionar.</Text>
          )}

          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Fechar
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={filtersOpen}
        onOpenChange={(open) => {
          if (!open && ignoreNextFiltersClose) {
            setIgnoreNextFiltersClose(false);
            setFiltersOpen(true);
            return;
          }

          if (!open && (groupPickerOpen || statusPickerOpen || attendantPickerOpen)) {
            return;
          }

          setFiltersOpen(open);
        }}
      >
        <Dialog.Content maxWidth="960px">
          <Dialog.Title>Filtros avancados</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Carrega opcoes do formulario de pesquisa do Softdesk e executa a consulta com a
            mesma sessao autenticada.
          </Dialog.Description>

          <Flex direction="column" gap="4">
            <Grid columns={{ initial: "1", md: "2", xl: "4" }} gap="3">
              <FilterSelect
                label="Pasta"
                value={advancedFilters.cd_pasta}
                options={getFolderOptions(folders)}
                onValueChange={(value) => {
                  if (value === ALL_FOLDERS_VALUE) {
                    setAdvancedFilters((current) => ({
                      ...current,
                      cd_pasta: "0",
                      tp_requisicao: "PES_RESULTADO",
                      tp_usuario: "PES",
                      pesq_cd_area: "0",
                      pesq_periodo: "0",
                      pesq_flag_periodo: "1",
                      cd_area: "0",
                      cd_cliente: "0",
                      cd_grupo_solucao: "0",
                    }));
                    return;
                  }

                  const folder = folders.find((item) => item.value === value);
                  setAdvancedFilters((current) => ({
                    ...current,
                    cd_pasta: value,
                    tp_requisicao: folder?.tpRequisicao ?? current.tp_requisicao,
                    tp_usuario: folder?.tpUsuario ?? current.tp_usuario,
                    cd_area: String(folder?.cdArea ?? current.cd_area),
                    cd_cliente: String(folder?.cdCliente ?? current.cd_cliente),
                    cd_grupo_solucao: String(
                      folder?.cdGrupoSolucao ?? current.cd_grupo_solucao,
                    ),
                  }));
                }}
              />
              <FilterSelect
                label="Area"
                value={advancedFilters.pesq_cd_area}
                options={getFieldOptions(filterFields, "area")}
                onValueChange={(value) =>
                  setAdvancedFilters((current) => ({ ...current, pesq_cd_area: value }))
                }
              />
              <FilterSelect
                label="Servico"
                value={advancedFilters.pesq_servico_chamado}
                options={getFieldOptions(filterFields, "servico")}
                onValueChange={(value) =>
                  setAdvancedFilters((current) => ({
                    ...current,
                    pesq_servico_chamado: value,
                  }))
                }
              />
              <FilterSelect
                label="Usuario"
                value={advancedFilters.pesq_cd_usuario}
                options={getFieldOptions(filterFields, "usuario")}
                onValueChange={(value) =>
                  setAdvancedFilters((current) => ({ ...current, pesq_cd_usuario: value }))
                }
              />
            </Grid>

            <Grid columns={{ initial: "1", md: "2" }} gap="3">
              <TextField.Root
                placeholder="Numero do chamado"
                value={advancedFilters.pesq_cd_chamado}
                onChange={(event) =>
                  setAdvancedFilters((current) => ({
                    ...current,
                    pesq_cd_chamado: event.target.value,
                  }))
                }
              />
              <TextField.Root
                placeholder="Texto da pesquisa"
                value={advancedFilters.pesq_ds_chamado}
                onChange={(event) =>
                  setAdvancedFilters((current) => ({
                    ...current,
                    pesq_ds_chamado: event.target.value,
                  }))
                }
              />
            </Grid>

            <Card variant="surface">
              <Grid columns={{ initial: "1", md: "3" }} gap="3" align="end">
                <Box>
                  <Text as="label" size="2" color="gray">
                    Inicio
                  </Text>
                  <TextField.Root
                    mt="2"
                    type="number"
                    min="0"
                    value={advancedFilters.start ?? ""}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({
                        ...current,
                        start: event.target.value,
                      }))
                    }
                  />
                </Box>
                <Box>
                  <Text as="label" size="2" color="gray">
                    Limite
                  </Text>
                  <TextField.Root
                    mt="2"
                    type="number"
                    min="1"
                    value={advancedFilters.limit ?? ""}
                    disabled={!advancedFilters.limit_enabled}
                    onChange={(event) =>
                      setAdvancedFilters((current) => ({
                        ...current,
                        limit: event.target.value,
                      }))
                    }
                  />
                </Box>
                <Flex align="center" justify="between" gap="3">
                  <Box>
                    <Text size="2">Aplicar limite</Text>
                    <Text as="p" size="1" color="gray">
                      Padrao seguro para evitar consultas pesadas.
                    </Text>
                  </Box>
                  <Switch
                    checked={advancedFilters.limit_enabled}
                    onCheckedChange={(checked) =>
                      setAdvancedFilters((current) => ({
                        ...current,
                        limit_enabled: checked,
                      }))
                    }
                  />
                </Flex>
              </Grid>
            </Card>

            <Grid columns={{ initial: "1", xl: "1.2fr 1fr" }} gap="4">
              <Card variant="surface">
                <Flex justify="between" align="center" mb="3">
                  <Box>
                    <Heading size="4">Grupo de solucao</Heading>
                    <Text size="2" color="gray">
                      Multiselecao baseada no formulario do Softdesk.
                    </Text>
                  </Box>
                  <Button
                    variant="soft"
                    size="2"
                    onClick={() => void loadFilterFields(advancedFilters.pesq_cd_area)}
                    disabled={filtersLoading}
                  >
                    Recarregar opcoes
                  </Button>
                </Flex>
                <Card variant="surface">
                  <Flex direction="column" gap="3" p="3">
                    <Flex align="center" justify="between" gap="3" wrap="wrap">
                      <Text size="2" color="gray">
                        {formatSelectionSummary(
                          advancedFilters.pesq_grupo_solucao_chamado,
                          getSpecificFieldOptions(filterFields, "grupo_solucao"),
                          "Todos os grupos",
                        )}
                      </Text>
                      <Button variant="soft" size="2" onClick={() => setGroupPickerOpen(true)}>
                        Selecionar grupos
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              </Card>

              <Card variant="surface">
                <Flex direction="column" gap="3">
                  <Card variant="surface">
                    <Flex align="center" justify="between" gap="3" p="3">
                      <Box>
                        <Text size="2">Somente com cobranca de atividade</Text>
                        <Text as="p" size="1" color="gray">
                          Consulta o detalhe de cada chamado e exige alguma atividade com
                          `fl_cobrar_atividade = 1`.
                        </Text>
                      </Box>
                      <Switch
                        checked={advancedFilters.somente_com_cobranca_atividade}
                        onCheckedChange={(checked) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            somente_com_cobranca_atividade: checked,
                          }))
                        }
                      />
                    </Flex>
                  </Card>
                  <Box>
                    <Text as="label" size="2" color="gray">
                      Atendente
                    </Text>
                    <Card variant="surface" mt="2">
                      <Flex direction="column" gap="3" p="3">
                        <Flex align="center" justify="between" gap="3" wrap="wrap">
                          <Text size="2" color="gray">
                            {formatSelectionSummary(
                              advancedFilters.pesq_cd_atendente,
                              getSpecificFieldOptions(filterFields, "atendente"),
                              "Todos os atendentes",
                            )}
                          </Text>
                          <Button
                            variant="soft"
                            size="2"
                            onClick={() => setAttendantPickerOpen(true)}
                          >
                            Selecionar atendentes
                          </Button>
                        </Flex>
                      </Flex>
                    </Card>
                  </Box>
                  <Box>
                    <Text as="label" size="2" color="gray">
                      Status
                    </Text>
                    <Card variant="surface" mt="2">
                      <Flex direction="column" gap="3" p="3">
                        <Flex align="center" justify="between" gap="3" wrap="wrap">
                          <Text size="2" color="gray">
                            {formatSelectionSummary(
                              advancedFilters.pesq_st_chamado,
                              getSpecificFieldOptions(filterFields, "status_chamado"),
                              "Todos os status",
                            )}
                          </Text>
                          <Button
                            variant="soft"
                            size="2"
                            onClick={() => setStatusPickerOpen(true)}
                          >
                            Selecionar status
                          </Button>
                        </Flex>
                      </Flex>
                    </Card>
                  </Box>
                  <Grid columns="2" gap="3">
                    <TextField.Root
                      type="date"
                      value={advancedFilters.pesq_periodo_ini}
                      onChange={(event) =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          pesq_periodo_ini: event.target.value,
                        }))
                      }
                    />
                    <TextField.Root
                      type="date"
                      value={advancedFilters.pesq_periodo_fim}
                      onChange={(event) =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          pesq_periodo_fim: event.target.value,
                        }))
                      }
                    />
                  </Grid>
                  <Flex align="center" justify="between">
                    <Text size="2">Exibir inativos</Text>
                    <Switch
                      checked={advancedFilters.pesq_bus_inativos}
                      onCheckedChange={(checked) =>
                        setAdvancedFilters((current) => ({
                          ...current,
                          pesq_bus_inativos: checked,
                        }))
                      }
                    />
                  </Flex>
                </Flex>
              </Card>
            </Grid>
          </Flex>

          <Flex gap="3" mt="5" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button onClick={() => void applyAdvancedFilters()} disabled={searchLoading}>
              Aplicar filtros
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={attendantPickerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeAttendantPickerKeepingFiltersOpen();
            return;
          }

          setAttendantPickerOpen(open);
        }}
      >
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>Atendente</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Selecione um ou mais atendentes para enviar como `pesq_cd_atendente[]`.
          </Dialog.Description>

          <ScrollArea
            type="always"
            scrollbars="vertical"
            style={{ maxHeight: 360, marginTop: 8 }}
          >
            <Flex direction="column" gap="2" pr="3">
              {filtersLoading ? (
                <>
                  <Skeleton height="36px" />
                  <Skeleton height="36px" />
                  <Skeleton height="36px" />
                </>
              ) : (
                getSpecificFieldOptions(filterFields, "atendente").map((option) => (
                  <label key={`${option.value}::${option.label}`}>
                    <Flex
                      align="center"
                      gap="3"
                      p="2"
                      style={{
                        borderRadius: 12,
                        border: "1px solid var(--gray-a4)",
                      }}
                    >
                      <Checkbox
                        checked={advancedFilters.pesq_cd_atendente.includes(option.value)}
                        onCheckedChange={(checked) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            pesq_cd_atendente: updateStringList(
                              current.pesq_cd_atendente,
                              option.value,
                              checked === true,
                            ),
                          }))
                        }
                      />
                      <Text size="2">{option.label}</Text>
                    </Flex>
                  </label>
                ))
              )}
            </Flex>
          </ScrollArea>

          <Flex gap="3" mt="5" justify="between">
            <Button
              variant="soft"
              color="gray"
              onClick={() =>
                setAdvancedFilters((current) => ({
                  ...current,
                  pesq_cd_atendente: [],
                }))
              }
            >
              Limpar
            </Button>
            <Flex gap="3">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Fechar
                </Button>
              </Dialog.Close>
              <Button onClick={closeAttendantPickerKeepingFiltersOpen}>Confirmar</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={statusPickerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeStatusPickerKeepingFiltersOpen();
            return;
          }

          setStatusPickerOpen(open);
        }}
      >
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>Status</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Selecione um ou mais status para enviar como `pesq_st_chamado[]`.
          </Dialog.Description>

          <ScrollArea
            type="always"
            scrollbars="vertical"
            style={{ maxHeight: 360, marginTop: 8 }}
          >
            <Flex direction="column" gap="2" pr="3">
              {filtersLoading ? (
                <>
                  <Skeleton height="36px" />
                  <Skeleton height="36px" />
                  <Skeleton height="36px" />
                </>
              ) : (
                getSpecificFieldOptions(filterFields, "status_chamado").map((option) => (
                  <label key={`${option.value}::${option.label}`}>
                    <Flex
                      align="center"
                      gap="3"
                      p="2"
                      style={{
                        borderRadius: 12,
                        border: "1px solid var(--gray-a4)",
                      }}
                    >
                      <Checkbox
                        checked={advancedFilters.pesq_st_chamado.includes(option.value)}
                        onCheckedChange={(checked) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            pesq_st_chamado: updateStringList(
                              current.pesq_st_chamado,
                              option.value,
                              checked === true,
                            ),
                          }))
                        }
                      />
                      <Text size="2">{option.label}</Text>
                    </Flex>
                  </label>
                ))
              )}
            </Flex>
          </ScrollArea>

          <Flex gap="3" mt="5" justify="between">
            <Button
              variant="soft"
              color="gray"
              onClick={() =>
                setAdvancedFilters((current) => ({
                  ...current,
                  pesq_st_chamado: [],
                }))
              }
            >
              Limpar
            </Button>
            <Flex gap="3">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Fechar
                </Button>
              </Dialog.Close>
              <Button onClick={closeStatusPickerKeepingFiltersOpen}>Confirmar</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={groupPickerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeGroupPickerKeepingFiltersOpen();
            return;
          }

          setGroupPickerOpen(open);
        }}
      >
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>Grupo de solucao</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Selecione um ou mais grupos para enviar como `pesq_grupo_solucao_chamado[]`.
          </Dialog.Description>

          <ScrollArea
            type="always"
            scrollbars="vertical"
            style={{ maxHeight: 360, marginTop: 8 }}
          >
            <Flex direction="column" gap="2" pr="3">
              {filtersLoading ? (
                <>
                  <Skeleton height="36px" />
                  <Skeleton height="36px" />
                  <Skeleton height="36px" />
                </>
              ) : (
                getSpecificFieldOptions(filterFields, "grupo_solucao").map((option) => (
                  <label key={`${option.value}::${option.label}`}>
                    <Flex
                      align="center"
                      gap="3"
                      p="2"
                      style={{
                        borderRadius: 12,
                        border: "1px solid var(--gray-a4)",
                      }}
                    >
                      <Checkbox
                        checked={advancedFilters.pesq_grupo_solucao_chamado.includes(
                          option.value,
                        )}
                        onCheckedChange={(checked) =>
                          setAdvancedFilters((current) => ({
                            ...current,
                            pesq_grupo_solucao_chamado: updateStringList(
                              current.pesq_grupo_solucao_chamado,
                              option.value,
                              checked === true,
                            ),
                          }))
                        }
                      />
                      <Text size="2">{option.label}</Text>
                    </Flex>
                  </label>
                ))
              )}
            </Flex>
          </ScrollArea>

          <Flex gap="3" mt="5" justify="between">
            <Button
              variant="soft"
              color="gray"
              onClick={() =>
                setAdvancedFilters((current) => ({
                  ...current,
                  pesq_grupo_solucao_chamado: [],
                }))
              }
            >
              Limpar
            </Button>
            <Flex gap="3">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Fechar
                </Button>
              </Dialog.Close>
              <Button onClick={closeGroupPickerKeepingFiltersOpen}>Confirmar</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "amber" | "green" | "cyan";
}) {
  return (
    <Card size="4" className="glass-panel">
      <Flex justify="between" align="start">
        <Box>
          <Text size="2" color="gray">
            {label}
          </Text>
          <Heading size="7" mt="2">
            {value}
          </Heading>
        </Box>
        <Badge color={tone} variant="soft" size="3">
          {icon}
        </Badge>
      </Flex>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Card variant="surface">
      <Text size="2" color="gray">
        {label}
      </Text>
      <Text as="p" size="3" mt="1">
        {value || "-"}
      </Text>
    </Card>
  );
}

function formatMetricValue(value: number | null) {
  return value === null ? "-" : String(value);
}

function formatOptionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value);
}

function getKanbanFieldLabel(field: KanbanGroupField) {
  return KANBAN_GROUP_FIELD_OPTIONS.find((option) => option.value === field)?.label ?? field;
}

function createEmptyBrowserLoginState(): BrowserLoginState {
  return {
    username: "",
    password: "",
    userType: "A",
  };
}

function createEmptyCustomColumnDraftState(): CustomColumnDraftState {
  return {
    label: "",
    matchValue: "",
  };
}

function createDefaultKanbanFilters(): KanbanFiltersState {
  return {
    text: "",
    status: "",
    priority: "",
    attendant: "",
  };
}

function extractChamadoActivities(detail: Chamado): ChamadoActivityView[] {
  const rawActivities = detail.atividades;
  if (!Array.isArray(rawActivities)) {
    return [];
  }

  return rawActivities
    .map((activity, index) => normalizeChamadoActivityRecord(activity, index))
    .filter((activity): activity is ChamadoActivityView => Boolean(activity));
}

function extractInitialChamadoMessage(detail: Chamado) {
  const nestedChamado =
    detail.chamado && typeof detail.chamado === "object"
      ? (detail.chamado as Record<string, unknown>)
      : null;
  const rawMessage =
    (nestedChamado?.ds_chamado as string | undefined) ??
    (typeof detail.ds_chamado === "string" ? detail.ds_chamado : undefined);

  if (!rawMessage) {
    return null;
  }

  const normalized = htmlToPlainText(rawMessage);
  return normalized || null;
}

function normalizeChamadoActivityRecord(activity: unknown, index: number): ChamadoActivityView | null {
  if (!activity || typeof activity !== "object") {
    return null;
  }

  const record = activity as Record<string, unknown>;
  const id =
    pickStringValue(record, ["id", "cd_atividade_chamado", "codigo", "cd_atividade"]) ??
    String(index);
  const title =
    pickStringValue(record, ["cabecalho", "descricao", "corpo", "ds_atividade_chamado"]) ??
    `Atividade ${id}`;
  const description =
    pickStringValue(record, ["descricao", "corpo", "ds_atividade_chamado_pesquisa"]) ?? null;
  const user =
    pickStringValue(record, ["nm_atendente", "nm_usuario", "nm_tecnico", "nm_atendente_chamado"]) ??
    null;
  const status = pickStringValue(record, ["ds_tipo_atividade"]) ?? null;
  const typeCode =
    pickStringValue(record, ["tipo", "tp_atividade_chamado", "cd_tipo_atividade"]) ?? null;
  const dateRaw =
    pickStringValue(record, ["data", "dt_atividade_chamado", "dt_cadastro"]) ?? null;

  return {
    key: `${id}::${dateRaw ?? ""}`,
    id,
    title: htmlToPlainText(title),
    dateRaw,
    dateLabel: formatActivityDate(dateRaw),
    user,
    status,
    typeCode,
    description: description ? htmlToPlainText(description) : null,
    chargeable: isChargeableActivityValue(record.fl_cobrar_atividade),
  };
}

function ActivityIcon({ activity }: { activity: ChamadoActivityView }) {
  return getActivityIconElement(activity);
}

function getActivityIconElement(activity: ChamadoActivityView) {
  // Softdesk exposes multiple activity codes in `tipo` / `tp_atividade_chamado`.
  // Keep explicit mappings here as we discover more real payloads.
  switch (activity.typeCode) {
    case "26":
      return <Eye size={16} aria-hidden="true" />;
    case "8":
      return <ArrowRightCircle size={16} aria-hidden="true" />;
    case "12":
      return <Paperclip size={16} aria-hidden="true" />;
    case "4":
      return <PlayCircle size={16} aria-hidden="true" />;
    case "72":
      return <Pencil size={16} aria-hidden="true" />;
    case "89":
      return <CalendarClock size={16} aria-hidden="true" />;
    default:
      break;
  }

  const normalizedTitle = activity.title.toLowerCase();
  const normalizedDescription = (activity.description ?? "").toLowerCase();
  const content = `${normalizedTitle} ${normalizedDescription}`;

  if (content.includes("encaminh")) {
    return <ArrowRightCircle size={16} aria-hidden="true" />;
  }

  if (content.includes("document") || content.includes("anexo")) {
    return <Paperclip size={16} aria-hidden="true" />;
  }

  if (content.includes("primeiro atendimento")) {
    return <PlayCircle size={16} aria-hidden="true" />;
  }

  if (content.includes("editou")) {
    return <Pencil size={16} aria-hidden="true" />;
  }

  if (content.includes("termino previsto")) {
    return <CalendarClock size={16} aria-hidden="true" />;
  }

  if (content.includes("mensagem") || content.includes("resposta")) {
    return <MessageSquareText size={16} aria-hidden="true" />;
  }

  if (content.includes("arquivo")) {
    return <FileText size={16} aria-hidden="true" />;
  }

  if (content.includes("erro") || content.includes("falha")) {
    return <AlertCircle size={16} aria-hidden="true" />;
  }

  return <Info size={16} aria-hidden="true" />;
}

function pickStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }

    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function isChargeableActivityValue(value: unknown) {
  return value === 1 || value === "1" || value === true;
}

function formatActivityDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDate(value);
  }

  return value;
}

function htmlToPlainText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n\s+\n/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+\n/g, "\n")
      .trim(),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function applyKanbanFilters(items: Chamado[], filters: KanbanFiltersState) {
  const text = filters.text.trim().toLowerCase();
  const status = filters.status.trim().toLowerCase();
  const priority = filters.priority.trim().toLowerCase();
  const attendant = filters.attendant.trim().toLowerCase();

  return items.filter((item) => {
    if (
      text &&
      ![
        item.tt_chamado,
        item.nm_cliente,
        String(item.cd_chamado),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text))
    ) {
      return false;
    }

    if (status && !String(item.ds_status ?? "").toLowerCase().includes(status)) {
      return false;
    }

    if (priority && !String(item.ds_prioridade ?? "").toLowerCase().includes(priority)) {
      return false;
    }

    if (attendant && !String(item.nm_atendente ?? "").toLowerCase().includes(attendant)) {
      return false;
    }

    return true;
  });
}

function hasActiveKanbanFilters(filters: KanbanFiltersState) {
  return Boolean(
    filters.text.trim() ||
      filters.status.trim() ||
      filters.priority.trim() ||
      filters.attendant.trim(),
  );
}

function readBrowserLoginState(): BrowserLoginState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BROWSER_LOGIN_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isBrowserLoginState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeBrowserLoginState(value: BrowserLoginState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(BROWSER_LOGIN_STORAGE_KEY, JSON.stringify(value));
}

function clearBrowserLoginState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BROWSER_LOGIN_STORAGE_KEY);
}

function isBrowserLoginState(value: unknown): value is BrowserLoginState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BrowserLoginState).username === "string" &&
    typeof (value as BrowserLoginState).password === "string" &&
    typeof (value as BrowserLoginState).userType === "string"
  );
}

function normalizeItems(value: unknown): Chamado[] {
  return Array.isArray(value) ? (value as Chamado[]) : [];
}

function mergeChamadoDetail(base: Chamado, detail: Chamado | null | undefined) {
  if (!detail) {
    return base;
  }

  const nestedChamado =
    detail.chamado && typeof detail.chamado === "object"
      ? (detail.chamado as Record<string, unknown>)
      : null;
  const mergedDetail = nestedChamado ? ({ ...detail, ...nestedChamado } as Chamado) : detail;

  return {
    ...base,
    ...mergedDetail,
    cd_chamado: normalizeNumberField(mergedDetail.cd_chamado) ?? base.cd_chamado,
    tt_chamado: normalizeStringField(mergedDetail.tt_chamado) ?? base.tt_chamado,
    ds_status:
      normalizeStringField(mergedDetail.ds_status) ??
      normalizeStatusField(mergedDetail.st_chamado) ??
      base.ds_status,
    ds_prioridade: normalizeStringField(mergedDetail.ds_prioridade) ?? base.ds_prioridade,
    ds_grupo_solucao:
      normalizeStringField(mergedDetail.ds_grupo_solucao) ?? base.ds_grupo_solucao,
    ds_servico: normalizeStringField(mergedDetail.ds_servico) ?? base.ds_servico,
    nm_cliente: normalizeStringField(mergedDetail.nm_cliente) ?? base.nm_cliente,
    nm_atendente: normalizeStringField(mergedDetail.nm_atendente) ?? base.nm_atendente,
    da_chamado: normalizeStringField(mergedDetail.da_chamado) ?? base.da_chamado,
  };
}

function normalizeStringField(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumberField(value: unknown) {
  if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function normalizeStatusField(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const statusMap: Record<string, string> = {
    "1": "Em atendimento",
    "2": "Aguardando solicitante",
    "3": "Suspenso",
    "4": "Escalado",
    "5": "Resolvido",
    "6": "Fechado",
  };

  return statusMap[normalized] ?? normalized;
}

function createDefaultFilters(): AdvancedFiltersState {
  return {
    cd_pasta: "0",
    start: "0",
    limit: "80",
    limit_enabled: true,
    pesq_cd_chamado: "",
    pesq_ds_chamado: "",
    pesq_cd_area: "0",
    pesq_grupo_solucao_chamado: [],
    pesq_st_chamado: [],
    pesq_cd_atendente: [],
    somente_com_cobranca_atividade: false,
    pesq_cd_usuario: "0",
    pesq_servico_chamado: "0",
    pesq_categoria_chamado: "0",
    pesq_descricao_categoria_chamado: "",
    pesq_bus_inativos: false,
    pesq_periodo: "0",
    pesq_periodo_ini: "",
    pesq_periodo_fim: "",
    pesq_termino_previsto_chamado: "",
    pesq_flag_periodo: "1",
    pesq_tp_tag: "1",
    pesq_field: ["54"],
    tp_requisicao: "PES_RESULTADO",
    tp_usuario: "PES",
    cd_area: "0",
    cd_cliente: "0",
    cd_grupo_solucao: "0",
    pesq_tp_pesquisa: "0",
  };
}

function getFieldOptions(fields: SoftdeskFilterField[], key: string) {
  const match = fields.find((field) => field.key === key);
  const options = dedupeOptions(match?.options ?? []).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
  return dedupeOptions([{ value: "0", label: "Todos" }, ...options]);
}

function getSpecificFieldOptions(fields: SoftdeskFilterField[], key: string) {
  const match = fields.find((field) => field.key === key);
  return dedupeOptions(match?.options ?? []).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function getFolderOptions(folders: SoftdeskFolderOption[]) {
  const allOption = {
    value: ALL_FOLDERS_VALUE,
    label: "Todos os chamados",
  };

  if (folders.length === 0) {
    return [
      allOption,
      { value: "1", label: "Meus chamados / Em atendimento" },
      { value: "3", label: "Meus chamados / Aguardando solicitante" },
      { value: "8", label: "Pesquisa / Resultado" },
    ];
  }

  return [
    allOption,
    ...folders.map((folder) => ({
      value: folder.value,
      label: folder.label,
    })),
  ];
}

function updateStringList(values: string[], target: string, selected: boolean) {
  if (selected) {
    return values.includes(target) ? values : [...values, target];
  }

  return values.filter((value) => value !== target);
}

function dedupeOptions(options: Array<{ value: string; label: string }>) {
  const seen = new Set<string>();

  return options.filter((option) => {
    const fingerprint = `${option.value}::${option.label}`;
    if (seen.has(fingerprint)) {
      return false;
    }

    seen.add(fingerprint);
    return true;
  });
}

function formatSelectionSummary(
  values: string[],
  options: Array<{ value: string; label: string }>,
  emptyLabel: string,
) {
  if (values.length === 0) {
    return emptyLabel;
  }

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  if (selectedLabels.length <= 2) {
    return selectedLabels.join(", ");
  }

  return `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  return (
    <Box>
      <Text as="label" size="2" color="gray">
        {label}
      </Text>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger mt="2" />
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={`${option.value}::${option.label}`} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Box>
  );
}

type AdvancedFiltersState = {
  cd_pasta: string;
  start: string;
  limit: string;
  limit_enabled: boolean;
  pesq_cd_chamado: string;
  pesq_ds_chamado: string;
  pesq_cd_area: string;
  pesq_grupo_solucao_chamado: string[];
  pesq_st_chamado: string[];
  pesq_cd_atendente: string[];
  somente_com_cobranca_atividade: boolean;
  pesq_cd_usuario: string;
  pesq_servico_chamado: string;
  pesq_categoria_chamado: string;
  pesq_descricao_categoria_chamado: string;
  pesq_bus_inativos: boolean;
  pesq_periodo: string;
  pesq_periodo_ini: string;
  pesq_periodo_fim: string;
  pesq_termino_previsto_chamado: string;
  pesq_flag_periodo: string;
  pesq_tp_tag: string;
  pesq_field: string[];
  tp_requisicao: string;
  tp_usuario: string;
  cd_area: string;
  cd_cliente: string;
  cd_grupo_solucao: string;
  pesq_tp_pesquisa: string;
};

type BrowserLoginState = {
  username: string;
  password: string;
  userType: string;
};

type CustomColumnDraftState = {
  label: string;
  matchValue: string;
};

type KanbanFiltersState = {
  text: string;
  status: string;
  priority: string;
  attendant: string;
};

type ChamadoActivityView = {
  key: string;
  id: string | null;
  title: string;
  dateRaw: string | null;
  dateLabel: string;
  user: string | null;
  status: string | null;
  typeCode: string | null;
  description: string | null;
  chargeable: boolean;
};

const ALL_FOLDERS_VALUE = "__ALL_FOLDERS__";
const BROWSER_LOGIN_STORAGE_KEY = "softdesk-browser-login";

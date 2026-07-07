import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mockChamados } from "@/data/mock-chamados";
import { getSoftdeskRegistry } from "@/lib/softdesk/registry";
import type {
  SoftdeskListParams,
  SoftdeskSearchForm,
  SoftdeskSearchPayloadSchema,
} from "@/lib/softdesk/schema";
import type {
  AttachmentPayload,
  Chamado,
  SoftdeskFilterField,
  SoftdeskFolderOption,
} from "@/types/softdesk";

export interface ChamadosDataSource {
  name: "softdesk" | "mock";
  listChamados(params: SoftdeskListParams): Promise<Chamado[]>;
  loadSearchForm(params: SoftdeskSearchForm): Promise<SoftdeskFilterField[]>;
  loadSearchFormDebug?(
    params: SoftdeskSearchForm,
  ): Promise<{ fields: SoftdeskFilterField[]; raw: unknown }>;
  listFolders(): Promise<SoftdeskFolderOption[]>;
  searchChamados(params: SoftdeskSearchPayloadSchema): Promise<Chamado[]>;
  getChamadoDetail(cdChamado: number): Promise<Chamado | null>;
  downloadAttachment(
    cdChamado: number,
    cdAnexo: number,
  ): Promise<AttachmentPayload | null>;
}

export type ChamadosLoadResult = {
  items: Chamado[];
  source: "softdesk" | "mock";
  warning: string | null;
};

export type ChamadoDetailLoadResult = {
  item: Chamado | null;
  source: "softdesk" | "mock";
  warning: string | null;
};

export type ChamadosFilterFormResult = {
  fields: SoftdeskFilterField[];
  source: "softdesk" | "mock";
  warning: string | null;
  debug: {
    raw: unknown;
    extracted: Array<{
      key: string;
      label: string;
      optionCount: number;
      sample: Array<{ value: string; label: string }>;
    }>;
  } | null;
};

export type ChamadosFoldersResult = {
  folders: SoftdeskFolderOption[];
  source: "softdesk" | "mock";
  warning: string | null;
};

class MockChamadosDataSource implements ChamadosDataSource {
  readonly name = "mock" as const;

  async listChamados(params: SoftdeskListParams) {
    const items = await readLocalChamados();
    return items.slice(params.start, params.start + params.limit);
  }

  async getChamadoDetail(cdChamado: number) {
    const items = await readLocalChamados();
    return items.find((item) => item.cd_chamado === cdChamado) ?? null;
  }

  async downloadAttachment(cdChamado: number, cdAnexo: number) {
    const payload = JSON.stringify(
      {
        cd_chamado: cdChamado,
        cd_anexo: cdAnexo,
        message: "Mock de anexo. Configure as credenciais para baixar o arquivo real.",
      },
      null,
      2,
    );

    return {
      buffer: Buffer.from(payload),
      contentType: "application/json",
      fileName: `mock-anexo-${cdChamado}-${cdAnexo}.json`,
    };
  }

  async loadSearchForm(_params: SoftdeskSearchForm) {
    const items = await readLocalChamados();
    return buildMockFilterFields(items);
  }

  async loadSearchFormDebug(params: SoftdeskSearchForm) {
    const fields = await this.loadSearchForm(params);
    return {
      fields,
      raw: {
        mock: true,
      },
    };
  }

  async searchChamados(params: SoftdeskSearchPayloadSchema) {
    const items = await readLocalChamados();
    const filtered = items
      .filter((item) => {
        if (params.pesq_cd_chamado && !String(item.cd_chamado).includes(params.pesq_cd_chamado)) {
          return false;
        }

        if (
          params.pesq_ds_chamado &&
          !String(item.tt_chamado ?? "")
            .toLowerCase()
            .includes(params.pesq_ds_chamado.toLowerCase())
        ) {
          return false;
        }

        if (
          params.pesq_grupo_solucao_chamado.length > 0 &&
          !params.pesq_grupo_solucao_chamado.includes(String(item.cd_grupo_solucao ?? ""))
        ) {
          return false;
        }

        if (
          params.pesq_servico_chamado > 0 &&
          Number(item.cd_servico ?? 0) !== params.pesq_servico_chamado
        ) {
          return false;
        }

        if (
          params.pesq_cd_atendente.length > 0 &&
          !params.pesq_cd_atendente.includes(
            String(Number(item.cd_atendente ?? item.cd_tecnico ?? 0)),
          )
        ) {
          return false;
        }

        return true;
      });

    if (params.limit === null) {
      return filtered.slice(params.start);
    }

    return filtered.slice(params.start, params.start + params.limit);
  }

  async listFolders() {
    return [
      {
        label: "Meus chamados / Em atendimento",
        value: "1",
        tpRequisicao: "EM_ATENDIMENTO",
        tpUsuario: "ATE",
        cdArea: 0,
        cdCliente: 0,
        cdGrupoSolucao: 0,
      },
      {
        label: "Meus chamados / Aguardando solicitante",
        value: "3",
        tpRequisicao: "SUSPENSO",
        tpUsuario: "ATE",
        cdArea: 0,
        cdCliente: 0,
        cdGrupoSolucao: 0,
      },
      {
        label: "Pesquisa / Resultado",
        value: "8",
        tpRequisicao: "PES_RESULTADO",
        tpUsuario: "PES",
        cdArea: 0,
        cdCliente: 0,
        cdGrupoSolucao: 0,
      },
    ];
  }
}

class SoftdeskChamadosDataSource implements ChamadosDataSource {
  readonly name = "softdesk" as const;

  async listChamados(params: SoftdeskListParams) {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.list(params);
  }

  async getChamadoDetail(cdChamado: number) {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.detail(cdChamado);
  }

  async downloadAttachment(cdChamado: number, cdAnexo: number) {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.downloadAttachment(cdChamado, cdAnexo);
  }

  async loadSearchForm(params: SoftdeskSearchForm) {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.searchForm(params);
  }

  async loadSearchFormDebug(params: SoftdeskSearchForm) {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.searchFormDebug(params);
  }

  async searchChamados(params: SoftdeskSearchPayloadSchema) {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.search(params);
  }

  async listFolders() {
    const client = await getSoftdeskRegistry().connect();
    return client.chamados.treeviewFolders();
  }
}

export function getDataSource(): ChamadosDataSource {
  return getSoftdeskRegistry().isConfigured()
    ? new SoftdeskChamadosDataSource()
    : new MockChamadosDataSource();
}

export async function loadChamadosWithFallback(
  params: SoftdeskListParams,
): Promise<ChamadosLoadResult> {
  const primary = getDataSource();

  try {
    const items = await primary.listChamados(params);
    return {
      items,
      source: primary.name,
      warning: null,
    };
  } catch (error) {
    const fallback = new MockChamadosDataSource();
    const items = await fallback.listChamados(params);

    return {
      items,
      source: fallback.name,
      warning: formatSoftdeskError(error),
    };
  }
}

export async function loadChamadoDetailWithFallback(
  cdChamado: number,
): Promise<ChamadoDetailLoadResult> {
  const primary = getDataSource();

  try {
    const item = await primary.getChamadoDetail(cdChamado);
    return {
      item,
      source: primary.name,
      warning: null,
    };
  } catch (error) {
    const fallback = new MockChamadosDataSource();
    const item = await fallback.getChamadoDetail(cdChamado);

    return {
      item,
      source: fallback.name,
      warning: formatSoftdeskError(error),
    };
  }
}

export async function loadSearchFormWithFallback(
  params: SoftdeskSearchForm,
): Promise<ChamadosFilterFormResult> {
  const primary = getDataSource();

  try {
    const result =
      primary.loadSearchFormDebug !== undefined
        ? await primary.loadSearchFormDebug(params)
        : { fields: await primary.loadSearchForm(params), raw: null };
    return {
      fields: result.fields,
      source: primary.name,
      warning: null,
      debug: {
        raw: result.raw,
        extracted: summarizeExtractedFields(result.fields),
      },
    };
  } catch (error) {
    const fallback = new MockChamadosDataSource();
    const result = await fallback.loadSearchFormDebug(params);

    return {
      fields: result.fields,
      source: fallback.name,
      warning: formatSoftdeskError(error),
      debug: {
        raw: result.raw,
        extracted: summarizeExtractedFields(result.fields),
      },
    };
  }
}

export async function searchChamadosWithFallback(
  params: SoftdeskSearchPayloadSchema,
): Promise<ChamadosLoadResult> {
  const primary = getDataSource();

  try {
    const items = await primary.searchChamados(params);
    const filteredItems = params.somente_com_cobranca_atividade
      ? await filterChamadosWithChargeableActivity(primary, items)
      : items;
    return {
      items: filteredItems,
      source: primary.name,
      warning: null,
    };
  } catch (error) {
    const fallback = new MockChamadosDataSource();
    const items = await fallback.searchChamados(params);
    const filteredItems = params.somente_com_cobranca_atividade
      ? await filterChamadosWithChargeableActivity(fallback, items)
      : items;

    return {
      items: filteredItems,
      source: fallback.name,
      warning: formatSoftdeskError(error),
    };
  }
}

export async function loadFoldersWithFallback(): Promise<ChamadosFoldersResult> {
  const primary = getDataSource();

  try {
    const folders = await primary.listFolders();
    return {
      folders,
      source: primary.name,
      warning: null,
    };
  } catch (error) {
    const fallback = new MockChamadosDataSource();
    const folders = await fallback.listFolders();
    return {
      folders,
      source: fallback.name,
      warning: formatSoftdeskError(error),
    };
  }
}

async function readLocalChamados() {
  try {
    const filePath = join(process.cwd(), "chamados.json");
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as Chamado[];
  } catch {
    return mockChamados;
  }
}

function formatSoftdeskError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado ao consultar o Softdesk.";

  if (message.includes("419")) {
    return "Falha de autenticacao no Softdesk (419). Exibindo dados locais enquanto a sessao nao estabiliza.";
  }

  return `${message} Exibindo dados locais temporariamente.`;
}

function buildMockFilterFields(items: Chamado[]): SoftdeskFilterField[] {
  return [
    {
      key: "grupo_solucao",
      label: "Grupo de solucao",
      options: uniqueOptions(items, "cd_grupo_solucao", "ds_grupo_solucao"),
    },
    {
      key: "servico",
      label: "Servico",
      options: uniqueOptions(items, "cd_servico", "ds_servico"),
    },
    {
      key: "cliente",
      label: "Cliente",
      options: uniqueOptions(items, "cd_cliente", "nm_cliente"),
    },
    {
      key: "atendente",
      label: "Atendente",
      options: uniqueOptions(items, "cd_atendente", "nm_atendente"),
    },
    {
      key: "status_chamado",
      label: "Status",
      options: uniqueOptions(items, "st_chamado", "ds_status"),
    },
  ].filter((field) => field.options.length > 0);
}

function uniqueOptions(items: Chamado[], valueKey: string, labelKey: string) {
  const map = new Map<string, string>();

  items.forEach((item) => {
    const value = item[valueKey];
    const label = item[labelKey];

    if (value === undefined || value === null || !label) {
      return;
    }

    map.set(String(value), String(label));
  });

  return Array.from(map.entries()).map(([value, label]) => ({
    value,
    label,
  }));
}

function summarizeExtractedFields(fields: SoftdeskFilterField[]) {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    optionCount: field.options.length,
    sample: field.options.slice(0, 10),
  }));
}

async function filterChamadosWithChargeableActivity(
  dataSource: Pick<ChamadosDataSource, "getChamadoDetail">,
  items: Chamado[],
) {
  const detailChecks = await mapInBatches(items, 6, async (item) => {
    const detail = await dataSource.getChamadoDetail(item.cd_chamado);
    return {
      item,
      keep: detail ? hasChargeableActivity(detail) : false,
    };
  });

  return detailChecks.filter((entry) => entry.keep).map((entry) => entry.item);
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((item) => mapper(item)));
    results.push(...batchResults);
  }

  return results;
}

function hasChargeableActivity(detail: Chamado) {
  const visited = new WeakSet<object>();
  const queue: unknown[] = [detail];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (
      "fl_cobrar_atividade" in current &&
      isChargeableActivityFlag((current as Record<string, unknown>).fl_cobrar_atividade)
    ) {
      return true;
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return false;
}

function isChargeableActivityFlag(value: unknown) {
  if (value === 1 || value === "1" || value === true) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

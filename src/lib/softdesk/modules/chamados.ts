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
  SoftdeskFilterOption,
} from "@/types/softdesk";
import { SoftdeskModule } from "@/lib/softdesk/modules/base";

export class SoftdeskChamadosModule extends SoftdeskModule {
  async list(params: SoftdeskListParams): Promise<Chamado[]> {
    const search = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    );
    const response = await this.request(`/chamado/json?${search.toString()}`, {
      method: "GET",
      referer: this.getChamadosReferer(),
    });

    if (!response.ok) {
      throw new Error(`Falha ao listar chamados: ${response.status}`);
    }

    return normalizeChamadoCollection(await response.json());
  }

  async searchForm(payload: SoftdeskSearchForm): Promise<SoftdeskFilterField[]> {
    const result = await this.searchFormDebug(payload);
    return result.fields;
  }

  async searchFormDebug(
    payload: SoftdeskSearchForm,
  ): Promise<{ fields: SoftdeskFilterField[]; raw: unknown }> {
    const response = await this.request("/chamado/json-formulario/pesquisa", {
      method: "POST",
      referer: this.getChamadosReferer(),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar formulario de pesquisa: ${response.status}`);
    }

    const raw = await response.json();

    return {
      fields: normalizeFilterFields(raw),
      raw,
    };
  }

  async search(payload: SoftdeskSearchPayloadSchema): Promise<Chamado[]> {
    const search = buildSearchParams(payload);
    const response = await this.request(`/chamado/json?${search.toString()}`, {
      method: "GET",
      referer: this.getChamadosReferer(),
    });

    if (!response.ok) {
      throw new Error(`Falha ao pesquisar chamados: ${response.status}`);
    }

    return normalizeChamadoCollection(await response.json());
  }

  async treeviewFolders(): Promise<SoftdeskFolderOption[]> {
    const response = await this.request(
      "/chamado/treeview/json?tp_retorno=1&selecionado=PES-0-0-0-PES_RESULTADO",
      {
        method: "GET",
        referer: this.getChamadosReferer(),
      },
    );

    if (!response.ok) {
      throw new Error(`Falha ao carregar pastas do treeview: ${response.status}`);
    }

    return normalizeTreeviewFolders(await response.json());
  }

  async detail(cdChamado: number): Promise<Chamado | null> {
    const referer = `${this.getChamadosReferer()}/detalhe/${cdChamado}`;
    const attempts: Array<() => Promise<Response>> = [
      () =>
        this.request(`/chamado/detalhe/${cdChamado}/json`, {
          method: "POST",
          referer,
        }),
      () =>
        this.request(`/chamado/detalhe/${cdChamado}/json`, {
          method: "GET",
          referer,
        }),
      () =>
        this.request(`/chamado/detalhe/json?cd_chamado=${cdChamado}`, {
          method: "GET",
          referer,
        }),
      () =>
        this.request(`/chamado/${cdChamado}/json`, {
          method: "GET",
          referer,
        }),
      () =>
        this.request(`/chamado/detalhe/json`, {
          method: "POST",
          referer,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            cd_chamado: String(cdChamado),
          }),
        }),
    ];

    for (const attempt of attempts) {
      const response = await attempt();

      if (!response.ok) {
        continue;
      }

      return normalizeChamadoDetail(await response.json(), cdChamado);
    }

    return null;
  }

  async downloadAttachment(
    cdChamado: number,
    cdAnexo: number,
  ): Promise<AttachmentPayload | null> {
    const response = await this.request(
      `/download/chamado/${cdChamado}/anexo/${cdAnexo}`,
      {
        method: "GET",
        referer: this.getChamadosReferer(),
      },
    );

    if (!response.ok) {
      return null;
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      fileName: `chamado-${cdChamado}-anexo-${cdAnexo}`,
    };
  }

  private getChamadosReferer() {
    return "/chamado";
  }
}

function normalizeChamadoCollection(payload: unknown): Chamado[] {
  if (Array.isArray(payload)) {
    return payload as Chamado[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = ["lista", "data", "items", "rows", "results", "chamados"] as const;

  for (const key of candidates) {
    const value = payload[key as keyof typeof payload];
    if (Array.isArray(value)) {
      return value as Chamado[];
    }
  }

  return [];
}

function normalizeChamadoDetail(payload: unknown, cdChamado: number): Chamado | null {
  const containerMatch = normalizeChamadoDetailContainer(payload, cdChamado);
  if (containerMatch) {
    return containerMatch;
  }

  const directMatch = findChamadoRecord(payload, cdChamado);
  if (directMatch) {
    return directMatch;
  }

  const collectionMatch = normalizeChamadoCollection(payload).find(
    (item) => item.cd_chamado === cdChamado,
  );
  if (collectionMatch) {
    return collectionMatch;
  }

  return null;
}

function normalizeChamadoDetailContainer(payload: unknown, cdChamado: number): Chamado | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const hasDetailShape = [
    "atividades",
    "anexos",
    "avaliacoes",
    "chat",
    "sla",
    "chamado",
    "item",
  ].some((key) => key in record);

  if (!hasDetailShape) {
    return null;
  }

  const rawItem =
    record.item && typeof record.item === "object" && !Array.isArray(record.item)
      ? (record.item as Record<string, unknown>)
      : null;
  const rawChamado =
    record.chamado && typeof record.chamado === "object" && !Array.isArray(record.chamado)
      ? (record.chamado as Record<string, unknown>)
      : null;

  const mergedRecord = {
    ...record,
    ...(rawItem ?? {}),
    ...(rawChamado ?? {}),
  };

  const normalized = normalizeChamadoRecord(mergedRecord);
  if (!normalized) {
    return null;
  }

  if (normalized.cd_chamado !== cdChamado) {
    return null;
  }

  return {
    ...mergedRecord,
    ...normalized,
  };
}

function findChamadoRecord(payload: unknown, cdChamado: number): Chamado | null {
  const queue: unknown[] = [payload];
  const visited = new WeakSet<object>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const record = current as Record<string, unknown>;
    const recordChamado = normalizeChamadoRecord(record);

    if (recordChamado && recordChamado.cd_chamado === cdChamado) {
      return recordChamado;
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

function normalizeChamadoRecord(record: Record<string, unknown>): Chamado | null {
  const rawCdChamado =
    pickFirst(record, ["cd_chamado", "id_chamado", "nr_chamado", "codigo", "id"]) ?? null;
  const rawTitulo =
    pickFirst(record, ["tt_chamado", "titulo", "ds_chamado", "assunto", "descricao"]) ?? null;

  if (rawCdChamado === null && rawTitulo === null) {
    return null;
  }

  const parsedCdChamado =
    rawCdChamado === null ? NaN : Number(String(rawCdChamado).trim());

  if (Number.isNaN(parsedCdChamado) && rawTitulo === null) {
    return null;
  }

  return {
    ...record,
    cd_chamado: Number.isNaN(parsedCdChamado) ? 0 : parsedCdChamado,
    tt_chamado: rawTitulo === null ? "" : String(rawTitulo),
    ds_status: toOptionalString(
      pickFirst(record, ["ds_status", "ds_status_chamado", "nm_status_chamado", "status"]),
    ),
    ds_prioridade: toOptionalString(
      pickFirst(record, ["ds_prioridade", "ds_prioridade_chamado", "prioridade"]),
    ),
    ds_grupo_solucao: toOptionalString(
      pickFirst(record, ["ds_grupo_solucao", "nm_grupo_solucao", "grupo_solucao"]),
    ),
    ds_servico: toOptionalString(pickFirst(record, ["ds_servico", "nm_servico", "servico"])),
    nm_cliente: toOptionalString(pickFirst(record, ["nm_cliente", "ds_cliente", "cliente"])),
    nm_atendente: toOptionalString(
      pickFirst(record, ["nm_atendente", "ds_atendente", "nm_tecnico", "ds_tecnico"]),
    ),
    da_chamado: toOptionalString(
      pickFirst(record, ["da_chamado", "dt_chamado", "dt_abertura", "data_abertura"]),
    ),
  };
}

function toOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function normalizeFilterFields(payload: unknown): SoftdeskFilterField[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const fieldMap: Array<{ key: string; label: string; aliases: string[] }> = [
    { key: "area", label: "Area", aliases: ["area", "areas"] },
    { key: "cliente", label: "Cliente", aliases: ["cliente", "clientes"] },
    {
      key: "grupo_solucao",
      label: "Grupo de solucao",
      aliases: ["grupo_solucao", "grupo_solucao_chamado", "grupos_solucao"],
    },
    { key: "servico", label: "Servico", aliases: ["servico", "servicos"] },
    { key: "usuario", label: "Usuario", aliases: ["usuario", "usuarios"] },
    {
      key: "atendente",
      label: "Atendente",
      aliases: ["atendente", "atendentes", "tecnico", "tecnicos"],
    },
    {
      key: "categoria",
      label: "Categoria",
      aliases: ["categoria", "categorias", "categoria_chamado", "categorias_chamado"],
    },
    { key: "prioridade", label: "Prioridade", aliases: ["prioridade", "prioridades"] },
    {
      key: "status_chamado",
      label: "Status",
      aliases: ["status_chamado", "status", "statuses"],
    },
    { key: "filial", label: "Filial", aliases: ["filial", "filiais"] },
    {
      key: "departamento",
      label: "Departamento",
      aliases: ["departamento", "departamentos"],
    },
    {
      key: "fornecedor",
      label: "Fornecedor",
      aliases: ["fornecedor", "fornecedores"],
    },
    { key: "projeto", label: "Projeto", aliases: ["projeto", "projetos"] },
    { key: "tag", label: "Tag", aliases: ["tag", "tags"] },
    {
      key: "tipo_chamado",
      label: "Tipo de chamado",
      aliases: ["tipo_chamado", "tipos_chamado", "tipo"],
    },
  ];

  return fieldMap
    .map((field) => {
      const source = findFieldSource(payload, field.aliases);
      const options = normalizeFilterOptions(source);

      return {
        key: field.key,
        label: field.label,
        options,
      };
    })
    .filter((field) => field.options.length > 0);
}

function normalizeFilterOptions(payload: unknown): SoftdeskFilterOption[] {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const nested = unwrapNestedOptions(payload);
    if (nested) {
      return normalizeFilterOptions(nested);
    }

    return Object.entries(payload)
      .map(([value, label]) => {
        if (typeof label !== "string" && typeof label !== "number") {
          return null;
        }

        return {
          label: String(label),
          value: String(value),
        };
      })
      .filter((item): item is SoftdeskFilterOption => Boolean(item))
      .filter(isUsableOption);
  }

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (item === null || item === undefined) {
        return null;
      }

      if (typeof item === "string" || typeof item === "number") {
        return {
          label: String(item),
          value: String(item),
        };
      }

      if (typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const pair =
        pickValueLabelPair(record, "cd_area", ["ds_area", "nm_area", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_atendente", ["nm_atendente", "ds_atendente", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_tecnico", ["nm_tecnico", "ds_tecnico", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_cliente", ["nm_cliente", "ds_cliente", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_grupo_solucao", ["ds_grupo_solucao", "nm_grupo_solucao", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_servico", ["ds_servico", "nm_servico", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_usuario", ["nm_usuario", "ds_usuario", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_status_chamado", ["ds_status_chamado", "nm_status_chamado", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_filial", ["nm_filial", "ds_filial", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_departamento", ["nm_departamento", "ds_departamento", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_fornecedor", ["nm_fornecedor", "ds_fornecedor", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_projeto", ["nm_projeto", "ds_projeto", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_tag", ["ds_tag", "nm_tag", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_tipo_chamado", ["ds_tipo_chamado", "nm_tipo_chamado", "descricao", "ds"]) ??
        pickValueLabelPair(record, "cd_categoria_chamado", ["ds_categoria_chamado", "nm_categoria_chamado", "descricao", "ds"]);

      const value =
        pair?.value ??
        pickFirst(record, ["value", "id", "codigo", "cd", "key"]) ??
        "";
      const label =
        pair?.label ??
        pickFirst(record, [
          "label",
          "text",
          "nome",
          "titulo",
          "descricao",
          "descricao_completa",
          "ds",
          "nm",
        ]) ??
        value;

      if (!value || !label) {
        return null;
      }

      return {
        label: String(label),
        value: String(value),
      };
    })
    .filter((item): item is SoftdeskFilterOption => Boolean(item))
    .filter(isUsableOption);
}

function pickFirst(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return value;
    }
  }

  return null;
}

function pickValueLabelPair(
  record: Record<string, unknown>,
  valueKey: string,
  labelKeys: string[],
) {
  const value = record[valueKey];

  if (value === undefined || value === null || `${value}`.trim() === "") {
    return null;
  }

  const label = pickFirst(record, labelKeys);

  if (label === null || label === undefined || `${label}`.trim() === "") {
    return null;
  }

  return {
    value: String(value),
    label: String(label),
  };
}

function buildSearchParams(payload: SoftdeskSearchPayloadSchema) {
  const search = new URLSearchParams();

  search.set("cd_pasta", String(payload.cd_pasta));
  search.set("start", String(payload.start));
  if (payload.limit !== null) {
    search.set("limit", String(payload.limit));
  }
  search.set("pesq_cd_chamado", payload.pesq_cd_chamado);
  search.set("pesq_ds_chamado", payload.pesq_ds_chamado);
  search.set("pesq_tp_pesquisa", String(payload.pesq_tp_pesquisa));
  search.set("pesq_cd_area", String(payload.pesq_cd_area));

  payload.pesq_grupo_solucao_chamado.forEach((value) => {
    search.append("pesq_grupo_solucao_chamado[]", value);
  });

  payload.pesq_st_chamado.forEach((value) => {
    search.append("pesq_st_chamado[]", value);
  });

  payload.pesq_cd_atendente.forEach((value) => {
    search.append("pesq_cd_atendente[]", value);
  });

  search.set("pesq_cd_usuario", String(payload.pesq_cd_usuario));
  search.set("pesq_servico_chamado", String(payload.pesq_servico_chamado));
  search.set("pesq_tp_tag", String(payload.pesq_tp_tag));
  search.set("pesq_categoria_chamado", String(payload.pesq_categoria_chamado));
  search.set("pesq_descricao_categoria_chamado", payload.pesq_descricao_categoria_chamado);
  search.set("pesq_bus_inativos", String(payload.pesq_bus_inativos));
  search.set("pesq_periodo", String(payload.pesq_periodo));
  search.set("pesq_periodo_ini", payload.pesq_periodo_ini);
  search.set("pesq_periodo_fim", payload.pesq_periodo_fim);
  search.set(
    "pesq_termino_previsto_chamado",
    payload.pesq_termino_previsto_chamado,
  );
  search.set("pesq_flag_periodo", String(payload.pesq_flag_periodo));
  search.set("tp_requisicao", payload.tp_requisicao);
  search.set("tp_usuario", payload.tp_usuario);
  search.set("cd_area", String(payload.cd_area));
  search.set("cd_cliente", String(payload.cd_cliente));
  search.set("cd_grupo_solucao", String(payload.cd_grupo_solucao));

  payload.pesq_field.forEach((value) => {
    search.append("pesq_field[]", value);
  });

  return search;
}

function findFieldSource(payload: unknown, aliases: string[]): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;

  for (const alias of aliases) {
    if (alias in record) {
      return record[alias];
    }
  }

  for (const value of Object.values(record)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const nested = findFieldSource(value, aliases);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function unwrapNestedOptions(payload: object) {
  const record = payload as Record<string, unknown>;
  const candidateKeys = ["options", "items", "lista", "data", "rows", "results"];

  for (const key of candidateKeys) {
    const value = record[key];
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return value;
    }
  }

  return undefined;
}

function isUsableOption(option: SoftdeskFilterOption) {
  const label = option.label.trim();
  const value = option.value.trim();

  if (!label || !value) {
    return false;
  }

  // Some Softdesk payloads include aggregated summary rows that are not valid choices.
  if (label.includes("{") || label.includes("}")) {
    return false;
  }

  return true;
}

function normalizeTreeviewFolders(payload: unknown): SoftdeskFolderOption[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const folders: SoftdeskFolderOption[] = [];

  const visitNodes = (nodes: unknown[], parents: string[] = []) => {
    nodes.forEach((node) => {
      if (!node || typeof node !== "object") {
        return;
      }

      const record = node as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text : "";
      const data =
        record.data && typeof record.data === "object"
          ? (record.data as Record<string, unknown>)
          : null;

      if (data && data.cd_pasta !== undefined && data.tp_requisicao && data.tp_usuario) {
        const section = parents.join(" / ");
        folders.push({
          label: section ? `${section} / ${text}` : text,
          value: String(data.cd_pasta),
          tpRequisicao: String(data.tp_requisicao),
          tpUsuario: String(data.tp_usuario),
          cdArea: Number(data.cd_area ?? 0),
          cdCliente: Number(data.cd_cliente ?? 0),
          cdGrupoSolucao: Number(data.cd_grupo_solucao ?? 0),
        });
      }

      if (Array.isArray(record.children)) {
        visitNodes(record.children, text ? [...parents, text] : parents);
      }
    });
  };

  visitNodes(payload);

  const seen = new Set<string>();
  return folders.filter((folder) => {
    const key = `${folder.value}::${folder.tpRequisicao}::${folder.tpUsuario}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

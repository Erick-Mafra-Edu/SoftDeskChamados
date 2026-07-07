export type Chamado = {
  cd_chamado: number;
  tt_chamado: string;
  ds_status?: string;
  ds_prioridade?: string;
  ds_grupo_solucao?: string;
  ds_servico?: string;
  nm_cliente?: string;
  nm_atendente?: string;
  da_chamado?: string;
  qtd_interacoes?: number;
  nr_anexo?: number;
  [key: string]: unknown;
};

export type SoftdeskFilterOption = {
  label: string;
  value: string;
};

export type SoftdeskFolderOption = {
  label: string;
  value: string;
  tpRequisicao: string;
  tpUsuario: string;
  cdArea: number;
  cdCliente: number;
  cdGrupoSolucao: number;
};

export type SoftdeskFilterField = {
  key: string;
  label: string;
  options: SoftdeskFilterOption[];
};

export type SoftdeskSearchFormResponse = {
  fields: SoftdeskFilterField[];
  source: "softdesk" | "mock";
  warning?: string | null;
  debug?: {
    raw: unknown;
    extracted: Array<{
      key: string;
      label: string;
      optionCount: number;
      sample: SoftdeskFilterOption[];
    }>;
  } | null;
};

export type SoftdeskFolderResponse = {
  folders: SoftdeskFolderOption[];
  source: "softdesk" | "mock";
  warning?: string | null;
};

export type SoftdeskSearchPayload = {
  cd_pasta: number;
  start: number;
  limit: number | null;
  pesq_cd_chamado?: string;
  pesq_ds_chamado?: string;
  pesq_cd_area: number;
  pesq_grupo_solucao_chamado: string[];
  pesq_st_chamado: string[];
  pesq_cd_atendente: string[];
  somente_com_cobranca_atividade: boolean;
  pesq_cd_usuario: number;
  pesq_servico_chamado: number;
  pesq_categoria_chamado: number;
  pesq_descricao_categoria_chamado?: string;
  pesq_bus_inativos: boolean;
  pesq_periodo: number;
  pesq_periodo_ini?: string;
  pesq_periodo_fim?: string;
  pesq_termino_previsto_chamado?: string;
  pesq_flag_periodo: number;
  pesq_tp_tag: number;
  pesq_field: string[];
  tp_requisicao: string;
  tp_usuario: string;
};

export type ChamadoListResponse = {
  items: Chamado[];
  source: "softdesk" | "mock";
  total: number;
  warning?: string | null;
};

export type ChamadoDetailResponse = {
  item: Chamado;
  source: "softdesk" | "mock";
  warning?: string | null;
};

export type AttachmentPayload = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
};

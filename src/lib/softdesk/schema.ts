import { z } from "zod";

const numericLike = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return defaultValue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return defaultValue;
      }

      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    if (typeof value === "number") {
      return Number.isNaN(value) ? defaultValue : value;
    }

    return value;
  }, z.number().default(defaultValue));

const optionalNumericLike = () =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }

    if (typeof value === "number") {
      return Number.isNaN(value) ? null : value;
    }

    return value;
  }, z.number().nullable().default(null));

export const credentialsSchema = z.object({
  baseUrl: z.string().url().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  userType: z.string().default("A").optional(),
  loginRedirect: z.string().default("/chamado").optional(),
  acceptLanguage: z
    .string()
    .default("en,es;q=0.9,en-US;q=0.8,pt-BR;q=0.7,pt;q=0.6")
    .optional(),
  userAgent: z
    .string()
    .default(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    )
    .optional(),
  cookie: z.string().optional(),
  xsrfToken: z.string().optional(),
  csrfToken: z.string().optional(),
  sendCsrfToken: z.coerce.boolean().default(false).optional(),
});

export const listParamsSchema = z.object({
  cd_pasta: numericLike(1),
  cd_area: numericLike(0),
  cd_cliente: numericLike(0),
  cd_grupo_solucao: numericLike(0),
  tp_requisicao: z.string().default("EM_ATENDIMENTO"),
  tp_usuario: z.string().default("ATE"),
  start: numericLike(0),
  limit: numericLike(50),
});

export const searchFormSchema = z.object({
  ref: z.string().default("mounted"),
  cd_area: numericLike(155),
  cd_cliente: z.array(z.union([z.string(), z.number()])).default([]),
  flag_exibir_inativos: z.coerce.boolean().default(false),
  flag_listar_todos_clientes: z.coerce.boolean().default(true),
  flag_listar_todas_filiais: z.coerce.boolean().default(true),
  campos: z
    .array(z.string())
    .default([
      "area",
      "atendente",
      "cliente",
      "grupo_solucao",
      "prioridade",
      "servico",
      "tag",
      "tipo_chamado",
      "usuario",
      "versao",
      "projeto",
      "status_chamado",
      "fornecedor",
      "departamento",
      "filial",
      "pesquisa_nr_filtros",
      "geral",
    ]),
});

export const searchPayloadSchema = z.object({
  cd_pasta: numericLike(0),
  start: numericLike(0),
  limit: optionalNumericLike(),
  pesq_cd_chamado: z.string().default(""),
  pesq_ds_chamado: z.string().default(""),
  pesq_tp_pesquisa: numericLike(0),
  pesq_cd_area: numericLike(0),
  pesq_grupo_solucao_chamado: z.array(z.string()).default([]),
  pesq_st_chamado: z.array(z.string()).default([]),
  pesq_cd_atendente: z.array(z.string()).default([]),
  somente_com_cobranca_atividade: z.coerce.boolean().default(false),
  pesq_cd_usuario: numericLike(0),
  pesq_servico_chamado: numericLike(0),
  pesq_tp_tag: numericLike(1),
  pesq_categoria_chamado: numericLike(0),
  pesq_descricao_categoria_chamado: z.string().default(""),
  pesq_bus_inativos: z.coerce.boolean().default(false),
  pesq_periodo: numericLike(0),
  pesq_periodo_ini: z.string().default(""),
  pesq_periodo_fim: z.string().default(""),
  pesq_termino_previsto_chamado: z.string().default(""),
  pesq_flag_periodo: numericLike(2),
  tp_requisicao: z.string().default("PES_RESULTADO"),
  tp_usuario: z.string().default("PES"),
  cd_area: numericLike(0),
  cd_cliente: numericLike(0),
  cd_grupo_solucao: numericLike(0),
  pesq_field: z.array(z.string()).default(["54"]),
});

export type SoftdeskCredentialsInput = z.input<typeof credentialsSchema>;
export type SoftdeskCredentials = z.output<typeof credentialsSchema>;
export type SoftdeskListParams = z.output<typeof listParamsSchema>;
export type SoftdeskSearchForm = z.output<typeof searchFormSchema>;
export type SoftdeskSearchPayloadSchema = z.output<typeof searchPayloadSchema>;

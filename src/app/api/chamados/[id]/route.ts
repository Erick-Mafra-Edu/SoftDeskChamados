import { NextResponse } from "next/server";
import { loadChamadoDetailWithFallback } from "@/lib/server/data-source";
import type { Chamado } from "@/types/softdesk";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await loadChamadoDetailWithFallback(Number(id));
  const detail = result.item;

  if (!detail) {
    return NextResponse.json({ message: "Chamado nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    item: normalizeDetailPayload(detail),
    source: result.source,
    warning: result.warning,
  });
}

function normalizeDetailPayload(detail: Chamado) {
  const nestedItem =
    detail.item && typeof detail.item === "object"
      ? (detail.item as Record<string, unknown>)
      : null;
  const nestedChamado =
    detail.chamado && typeof detail.chamado === "object"
      ? (detail.chamado as Record<string, unknown>)
      : null;

  if (!nestedItem && !nestedChamado) {
    return detail;
  }

  return {
    ...detail,
    ...(nestedItem ?? {}),
    ...nestedChamado,
  };
}

import { NextResponse } from "next/server";
import { listParamsSchema } from "@/lib/softdesk/schema";
import { loadChamadosWithFallback } from "@/lib/server/data-source";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = listParamsSchema.parse(Object.fromEntries(searchParams));
  const result = await loadChamadosWithFallback(params);

  return NextResponse.json({
    items: result.items,
    source: result.source,
    total: result.items.length,
    warning: result.warning,
  });
}

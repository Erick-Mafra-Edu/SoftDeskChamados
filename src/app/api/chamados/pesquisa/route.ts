import { NextResponse } from "next/server";
import { searchPayloadSchema } from "@/lib/softdesk/schema";
import { searchChamadosWithFallback } from "@/lib/server/data-source";

export async function POST(request: Request) {
  const body = searchPayloadSchema.parse(await request.json());
  const result = await searchChamadosWithFallback(body);

  return NextResponse.json({
    items: result.items,
    source: result.source,
    total: result.items.length,
    warning: result.warning,
  });
}

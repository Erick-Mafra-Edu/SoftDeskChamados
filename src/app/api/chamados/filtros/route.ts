import { NextResponse } from "next/server";
import { searchFormSchema } from "@/lib/softdesk/schema";
import { loadSearchFormWithFallback } from "@/lib/server/data-source";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const params = searchFormSchema.parse(body);
  const result = await loadSearchFormWithFallback(params);

  return NextResponse.json({
    fields: result.fields,
    source: result.source,
    warning: result.warning,
    debug: result.debug,
  });
}

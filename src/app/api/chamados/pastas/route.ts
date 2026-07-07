import { NextResponse } from "next/server";
import { loadFoldersWithFallback } from "@/lib/server/data-source";

export async function GET() {
  const result = await loadFoldersWithFallback();

  return NextResponse.json({
    folders: result.folders,
    source: result.source,
    warning: result.warning,
  });
}

import { NextResponse } from "next/server";
import { credentialsSchema } from "@/lib/softdesk/schema";
import { getSoftdeskRegistry } from "@/lib/softdesk/registry";

export async function GET() {
  const registry = getSoftdeskRegistry();

  return NextResponse.json({
    configured: registry.isConfigured(),
    snapshot: registry.getSnapshot(),
  });
}

export async function POST(request: Request) {
  const payload = credentialsSchema.partial().parse(await request.json());
  const registry = getSoftdeskRegistry();

  const client = await registry.connect(payload);

  return NextResponse.json({
    configured: registry.isConfigured(),
    snapshot: registry.getSnapshot(),
    cookieCount: client.session.snapshot().cookies.length,
  });
}

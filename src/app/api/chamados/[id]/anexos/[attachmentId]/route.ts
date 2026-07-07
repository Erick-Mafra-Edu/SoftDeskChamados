import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/server/data-source";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { id, attachmentId } = await context.params;
  const dataSource = getDataSource();
  const attachment = await dataSource.downloadAttachment(
    Number(id),
    Number(attachmentId),
  );

  if (!attachment) {
    return NextResponse.json({ message: "Anexo indisponivel." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(attachment.buffer), {
    headers: {
      "content-type": attachment.contentType,
      "content-disposition": `inline; filename="${attachment.fileName}"`,
    },
  });
}

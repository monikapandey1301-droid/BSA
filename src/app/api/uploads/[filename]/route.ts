import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(process.cwd(), "uploads", filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine content type
    const ext = filename.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "pdf") contentType = "application/pdf";
    else if (ext === "txt") contentType = "text/plain";
    else if (ext === "md") contentType = "text/markdown";
    else if (ext === "docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to read file" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { parseDocument } from "@/lib/parser";
import fs from "fs";
import path from "path";

// Helper function to handle parsing in the background (non-blocking)
async function parseInBackground(docId: string, fileBuffer: Buffer, filename: string, projectId: string, uploadedBy: string) {
  try {
    // 1. Update status to Parsing
    await db.document.update({
      where: { id: docId },
      data: { status: "Parsing" }
    });

    // 2. Perform text extraction
    const extractedText = await parseDocument(fileBuffer, filename);

    // 3. Save parsed text and update status to Parsed
    const updatedDoc = await db.document.update({
      where: { id: docId },
      data: {
        status: "Parsed",
        parsedText: extractedText
      }
    });

    // 4. Log audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "Agent",
        actorId: "DocumentParser",
        action: "PARSE_DOCUMENT_SUCCESS",
        entityType: "Document",
        entityId: docId,
        afterSnapshotJson: JSON.stringify({ id: docId, filename, status: "Parsed" })
      }
    });

  } catch (error: any) {
    console.error(`Background parsing failed for document ${docId}:`, error);

    // Update status to ParsingFailed
    await db.document.update({
      where: { id: docId },
      data: { status: "ParsingFailed" }
    });

    // Log failure in audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "Agent",
        actorId: "DocumentParser",
        action: "PARSE_DOCUMENT_FAILED",
        entityType: "Document",
        entityId: docId,
        afterSnapshotJson: JSON.stringify({ error: error.message || "Unknown parsing error" })
      }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId parameter is required" }, { status: 400 });
    }

    const documents = await db.document.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(documents);
  } catch (error: any) {
    console.error("Error in GET /api/documents:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const uploadedBy = (formData.get("uploadedBy") as string | null) || "default_user";

    if (!file || !projectId) {
      return NextResponse.json({ error: "File and projectId are required" }, { status: 400 });
    }

    // Check if project exists
    const projectExists = await db.project.findUnique({
      where: { id: projectId }
    });
    if (!projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check file size (< 25MB per US-0201)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 25MB limit" }, { status: 400 });
    }

    // Check file extension
    const filename = file.name;
    const extension = filename.split(".").pop()?.toLowerCase();
    const supportedExtensions = ["pdf", "docx", "txt", "md"];
    if (!extension || !supportedExtensions.includes(extension)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    // Write file to local uploads directory
    const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeFilename);
    fs.writeFileSync(filePath, fileBuffer);
    const fileUrl = `/uploads/${safeFilename}`;

    // Create Document record in DB
    const doc = await db.document.create({
      data: {
        projectId,
        filename,
        fileUrl,
        status: "Uploaded",
        uploadedBy
      }
    });

    // Log upload in audit log
    await db.auditLog.create({
      data: {
        projectId,
        actorType: "User",
        actorId: uploadedBy,
        action: "UPLOAD_DOCUMENT",
        entityType: "Document",
        entityId: doc.id,
        afterSnapshotJson: JSON.stringify({ id: doc.id, filename, fileUrl })
      }
    });

    // Trigger parsing in the background
    parseInBackground(doc.id, fileBuffer, filename, projectId, uploadedBy);

    return NextResponse.json(doc);
  } catch (error: any) {
    console.error("Error in POST /api/documents:", error);
    return NextResponse.json({ error: error.message || "Failed to upload document" }, { status: 500 });
  }
}

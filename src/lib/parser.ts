import mammoth from "mammoth";

export async function parseDocument(fileBuffer: Buffer, fileName: string): Promise<string> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "txt":
    case "md":
      return fileBuffer.toString("utf-8");

    case "docx": {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }

    case "pdf": {
      try {
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(fileBuffer);
        return data.text;
      } catch (err: any) {
        throw new Error("Failed to parse PDF: " + err.message);
      }
    }

    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}

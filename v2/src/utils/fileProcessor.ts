export interface Attachment {
  id: string;
  name: string;
  type: "image" | "file";
  mimeType: string;
  size: number;
  content: string; // Base64 data URL for images, text content for files
  previewUrl?: string;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function isImageFile(file: File | { name: string; type?: string }): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(name);
}

export function isPdfFile(file: File | { name: string; type?: string }): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Extract human-readable text from PDF bytes without external binary dependencies.
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const textChunks: string[] = [];
  const textDecoder = new TextDecoder("latin1");
  const rawString = textDecoder.decode(bytes);

  // Strategy 1: Find streams and decompress if FlateDecode
  const streamRegex = /<<([^>]*\/Filter\s*\/FlateDecode[^>]*)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(rawString)) !== null) {
    try {
      const streamStart = match.index + match[0].indexOf("stream") + 6;
      const actualStart = rawString.charCodeAt(streamStart) === 13 && rawString.charCodeAt(streamStart + 1) === 10
        ? streamStart + 2
        : rawString.charCodeAt(streamStart) === 10
        ? streamStart + 1
        : streamStart;

      const streamEnd = match.index + match[0].lastIndexOf("endstream");
      const streamSlice = bytes.subarray(actualStart, streamEnd);

      if (streamSlice.length > 0 && typeof DecompressionStream !== "undefined") {
        try {
          const ds = new DecompressionStream("deflate");
          const writer = ds.writable.getWriter();
          writer.write(streamSlice);
          writer.close();
          const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
          const decompressedText = new TextDecoder("utf-8").decode(decompressedBuffer);
          
          const extracted = parsePdfTextOperators(decompressedText);
          if (extracted.trim()) {
            textChunks.push(extracted.trim());
          }
        } catch {
          // DecompressionStream with 'deflate-raw' if header mismatch
          try {
            const ds = new DecompressionStream("deflate-raw");
            const writer = ds.writable.getWriter();
            writer.write(streamSlice);
            writer.close();
            const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
            const decompressedText = new TextDecoder("utf-8").decode(decompressedBuffer);
            const extracted = parsePdfTextOperators(decompressedText);
            if (extracted.trim()) {
              textChunks.push(extracted.trim());
            }
          } catch {
            // Stream parse failed; continue
          }
        }
      }
    } catch {
      // Continue to next stream
    }
  }

  // Strategy 2: Also parse uncompressed text operators
  const uncompressedText = parsePdfTextOperators(rawString);
  if (uncompressedText.trim()) {
    textChunks.push(uncompressedText.trim());
  }

  const result = textChunks.join("\n\n").trim();
  if (result.length > 0) {
    return result;
  }

  return "[PDF attached: " + formatFileSize(buffer.byteLength) + " - text content could not be indexed]";
}

function parsePdfTextOperators(content: string): string {
  const result: string[] = [];
  // Match text blocks: BT ... ET
  const btRegex = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btRegex.exec(content)) !== null) {
    const block = btMatch[0];
    // Match literal strings like (Hello World) or hex strings like <48656c6c6f>
    const strRegex = /\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F]+>/g;
    let strMatch: RegExpExecArray | null;
    let blockText = "";

    while ((strMatch = strRegex.exec(block)) !== null) {
      const raw = strMatch[0];
      if (raw.startsWith("(") && raw.endsWith(")")) {
        const unescaped = raw.slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\([()\\])/g, "$1");
        blockText += unescaped + " ";
      } else if (raw.startsWith("<") && raw.endsWith(">")) {
        const hex = raw.slice(1, -1);
        let decoded = "";
        for (let i = 0; i < hex.length; i += 2) {
          const byte = parseInt(hex.substr(i, 2), 16);
          if (!isNaN(byte) && byte >= 32 && byte <= 126) {
            decoded += String.fromCharCode(byte);
          }
        }
        if (decoded) blockText += decoded + " ";
      }
    }

    if (blockText.trim()) {
      result.push(blockText.trim());
    }
  }

  return result.join(" ");
}

export async function processFile(file: File): Promise<Attachment> {
  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  if (isImageFile(file)) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    return {
      id,
      name: file.name,
      type: "image",
      mimeType: file.type || "image/png",
      size: file.size,
      content: dataUrl,
      previewUrl: dataUrl,
    };
  }

  if (isPdfFile(file)) {
    const buffer = await file.arrayBuffer();
    const text = await extractPdfText(buffer);

    return {
      id,
      name: file.name,
      type: "file",
      mimeType: "application/pdf",
      size: file.size,
      content: text,
    };
  }

  // Treat as text / code / markdown / configuration file
  const text = await file.text();
  return {
    id,
    name: file.name,
    type: "file",
    mimeType: file.type || "text/plain",
    size: file.size,
    content: text,
  };
}

export async function processFileList(files: FileList | File[]): Promise<Attachment[]> {
  const list = Array.from(files);
  const results: Attachment[] = [];
  for (const file of list) {
    try {
      const att = await processFile(file);
      results.push(att);
    } catch (err) {
      console.error(`Failed to process file ${file.name}:`, err);
    }
  }
  return results;
}

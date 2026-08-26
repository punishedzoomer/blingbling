import { useState, useMemo } from "react";
import { Download, Copy, Check, Maximize2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

export function resolveImageSrc(src?: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  let cleanPath = src;
  if (cleanPath.startsWith("asset://localhost/")) {
    cleanPath = "/" + cleanPath.slice("asset://localhost/".length);
  } else if (cleanPath.startsWith("asset://localhost")) {
    cleanPath = cleanPath.slice("asset://localhost".length);
  } else if (cleanPath.startsWith("asset:/")) {
    cleanPath = cleanPath.slice("asset:".length);
  } else if (cleanPath.startsWith("file://")) {
    cleanPath = cleanPath.slice("file://".length);
  }

  try {
    return convertFileSrc(decodeURIComponent(cleanPath));
  } catch {
    return src;
  }
}

interface ImageCardProps {
  src?: string;
  alt?: string;
}

export function ImageCard({ src, alt }: ImageCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const displaySrc = useMemo(() => resolveImageSrc(src), [src]);

  if (!src) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(displaySrc);
      const blob = await res.blob();

      // Universal clipboard copy as PNG image
      if (blob.type === "image/png") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } else {
        // Convert to PNG blob via canvas for universal OS paste compatibility
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = displaySrc;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const pngBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png")
        );
        if (pngBlob) {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": pngBlob }),
          ]);
        } else {
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type || "image/png"]: blob }),
          ]);
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed, fallback to raw source:", err);
      try {
        await navigator.clipboard.writeText(displaySrc);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e2) {
        console.error("Fallback clipboard write failed:", e2);
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = displaySrc;
      a.download = alt && alt !== "Generated Image"
        ? `${alt.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`
        : `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  return (
    <>
      <div
        className="relative group my-2 inline-flex flex-col self-start w-fit max-w-full rounded-xl overflow-hidden border border-[rgba(255,255,255,0.14)] bg-transparent shadow-md transition-all hover:border-[rgba(255,255,255,0.3)]"
        style={{ cursor: "zoom-in", width: "fit-content" }}
        onClick={() => setIsZoomed(true)}
      >
        <img
          src={displaySrc}
          alt={alt || "Generated Image"}
          loading="lazy"
          className="w-auto max-w-full h-auto max-h-[480px] rounded-xl object-contain block select-none"
        />

        {/* Hover action toolbar */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[rgba(18,20,26,0.85)] backdrop-blur-md px-2 py-1.5 rounded-lg border border-[rgba(255,255,255,0.14)] shadow-lg">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.12)] rounded transition-colors cursor-pointer"
            title={copied ? "Image Copied to Clipboard!" : "Copy Image Only"}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1 text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.12)] rounded transition-colors cursor-pointer"
            title="Download Image"
          >
            {downloading ? <Check size={14} className="text-blue-400" /> : <Download size={14} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(true);
            }}
            className="p-1 text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.12)] rounded transition-colors cursor-pointer"
            title="Zoom Full Size"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {alt && alt !== "Generated Image" && (
          <div className="px-3 py-1.5 text-[11px] text-gray-400 bg-[rgba(18,20,26,0.7)] border-t border-[rgba(255,255,255,0.06)] truncate max-w-full">
            {alt}
          </div>
        )}
      </div>

      {/* Lightbox / Full Size Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 cursor-zoom-out select-none"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
            <img
              src={displaySrc}
              alt={alt || "Fullsize Preview"}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="mt-3 flex items-center gap-3 bg-[rgba(18,20,26,0.9)] px-4 py-2 rounded-full border border-[rgba(255,255,255,0.15)]">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 text-xs text-gray-200 hover:text-white transition-colors cursor-pointer"
              >
                <Download size={14} /> Download
              </button>
              <span className="text-gray-600">|</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-200 hover:text-white transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {copied ? "Image Copied!" : "Copy Image"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from "react";
import { Download, Copy, Check, Maximize2 } from "lucide-react";

interface ImageCardProps {
  src?: string;
  alt?: string;
}

export function ImageCard({ src, alt }: ImageCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!src) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (src.startsWith("data:")) {
        // Copy base64 image directly to clipboard as blob
        const res = await fetch(src);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      } else {
        await navigator.clipboard.writeText(src);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const a = document.createElement("a");
      a.href = src;
      a.download = alt ? `${alt.replace(/[^a-zA-Z0-9_-]/g, "_")}.png` : `generated-image-${Date.now()}.png`;
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
        className="relative group my-3 inline-block max-w-full rounded-xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[#12141a] shadow-lg transition-all hover:border-[rgba(255,255,255,0.25)]"
        style={{ cursor: "zoom-in" }}
        onClick={() => setIsZoomed(true)}
      >
        <img
          src={src}
          alt={alt || "Generated Image"}
          loading="lazy"
          className="max-w-full h-auto max-h-[480px] rounded-xl object-contain block select-none"
        />

        {/* Hover action toolbar */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[rgba(18,20,26,0.85)] backdrop-blur-md px-2 py-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] shadow-md">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
            title={copied ? "Copied!" : "Copy image"}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1 text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
            title="Download image"
          >
            {downloading ? <Check size={14} className="text-blue-400" /> : <Download size={14} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(true);
            }}
            className="p-1 text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.1)] rounded transition-colors"
            title="Zoom full size"
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
              src={src}
              alt={alt || "Fullsize Preview"}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="mt-3 flex items-center gap-3 bg-[rgba(18,20,26,0.9)] px-4 py-2 rounded-full border border-[rgba(255,255,255,0.15)]">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 text-xs text-gray-200 hover:text-white transition-colors"
              >
                <Download size={14} /> Download
              </button>
              <span className="text-gray-600">|</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-200 hover:text-white transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Attachment, processFileList } from "../utils/fileProcessor";

export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingSnips, setPendingSnips] = useState<string[]>([]);
  const [pendingContextText, setPendingContextText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showTray, setShowTray] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  const addAttachments = useCallback((newAttachments: Attachment[]) => {
    if (newAttachments.length === 0) return;
    setAttachments((prev) => [...prev, ...newAttachments]);
    setShowTray(true);
  }, []);

  const addSnip = useCallback((snipBase64: string) => {
    setPendingSnips((prev) => [...prev, snipBase64]);
    setShowTray(true);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const removeSnip = useCallback((index: number) => {
    setPendingSnips((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAllAttachments = useCallback(() => {
    setAttachments([]);
    setPendingSnips([]);
    setPendingContextText("");
    setShowTray(false);
  }, []);

  const triggerFilePicker = useCallback(async () => {
    try {
      const picked = await invoke<Attachment[]>("pick_files");
      if (picked && picked.length > 0) {
        addAttachments(picked);
      }
    } catch (e) {
      console.warn("Native file picker failed or was cancelled:", e);
    }
  }, [addAttachments]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const processed = await processFileList(files);
      addAttachments(processed);
      e.target.value = ""; // Reset input so same file can be re-selected if needed
    }
  }, [addAttachments]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent | ClipboardEvent): Promise<boolean> => {
    const clipboardData = "clipboardData" in e ? e.clipboardData : null;
    if (!clipboardData) return false;

    // Check for image items in clipboard first (e.g. screenshot paste)
    const items = Array.from(clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    
    if (imageItems.length > 0) {
      const files: File[] = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      if (files.length > 0) {
        const processed = await processFileList(files);
        addAttachments(processed);
        return true;
      }
    }

    // Check for files copied from Finder / file explorer
    if (clipboardData.files && clipboardData.files.length > 0) {
      const files = Array.from(clipboardData.files);
      const processed = await processFileList(files);
      if (processed.length > 0) {
        addAttachments(processed);
        return true;
      }
    }

    return false;
  }, [addAttachments]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const processed = await processFileList(files);
      addAttachments(processed);
    }
  }, [addAttachments]);

  const buildSendPayload = useCallback((userPrompt: string) => {
    const imagePayloads: string[] = [...pendingSnips];
    const textAttachments: Attachment[] = [];

    for (const att of attachments) {
      if (att.type === "image") {
        imagePayloads.push(att.content);
      } else {
        textAttachments.push(att);
      }
    }

    // Format text attachments cleanly for the LLM
    let formattedContext = pendingContextText ? `\n\n<context>\n${pendingContextText}\n</context>` : "";

    if (textAttachments.length > 0) {
      const formattedFiles = textAttachments.map((file) => {
        return `<attachment name="${file.name}" type="${file.mimeType}">\n${file.content}\n</attachment>`;
      }).join("\n\n");

      formattedContext += (formattedContext ? "\n\n" : "\n\n") + `<attached_files>\n${formattedFiles}\n</attached_files>`;
    }

    const contentArray: any[] = [];
    if (userPrompt) {
      contentArray.push({ type: "text", text: userPrompt });
    }
    for (const img of imagePayloads) {
      contentArray.push({ type: "image_url", image_url: { url: img } });
    }
    if (formattedContext) {
      contentArray.push({ type: "text", text: formattedContext });
    }

    return {
      contentArray,
      images: imagePayloads,
      contextText: (pendingContextText || "") + (textAttachments.length > 0 ? (pendingContextText ? "\n\n" : "") + textAttachments.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n") : ""),
      attachmentsSnapshot: [...attachments],
      snipsSnapshot: [...pendingSnips],
    };
  }, [attachments, pendingSnips, pendingContextText]);

  const totalAttachmentsCount = attachments.length + pendingSnips.length;

  return {
    attachments,
    setAttachments,
    pendingSnips,
    setPendingSnips,
    pendingContextText,
    setPendingContextText,
    isDragging,
    previewImage,
    setPreviewImage,
    showTray,
    setShowTray,
    fileInputRef,
    totalAttachmentsCount,
    addAttachments,
    addSnip,
    removeAttachment,
    removeSnip,
    clearAllAttachments,
    triggerFilePicker,
    handleFileInputChange,
    handlePaste,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    buildSendPayload,
  };
}

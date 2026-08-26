import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Sparkles, Copy, Check } from "lucide-react";
import { useState, memo } from "react";
import { ImageCard } from "./media/ImageCard";
import { AudioPlayerCard } from "./media/AudioPlayerCard";

SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("rs", rust);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);
SyntaxHighlighter.registerLanguage("sql", sql);

const PreBlock = memo(({ children }: any) => {
  return <>{children}</>;
});

const CodeBlock = memo(({ node, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const rawCode = String(children || "");
  const code = rawCode.replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBlock = Boolean(
    match ||
    rawCode.includes("\n") ||
    (node && node.position && node.position.start.line !== node.position.end.line)
  );

  if (isBlock) {
    const language = match ? match[1] : "";

    return (
      <div className="relative group my-3 w-full max-w-full rounded-lg overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[#16181d] shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1e2026] border-b border-[rgba(255,255,255,0.08)] text-xs text-gray-400 select-none">
          <span className="font-mono text-[11px] font-medium tracking-wide text-gray-400 lowercase">
            {language || "code"}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="overflow-x-auto w-full p-3.5 text-[13px] leading-relaxed font-mono bg-[#13151a]">
          <SyntaxHighlighter
            style={atomDark as any}
            language={language || "text"}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: 0,
              background: "transparent",
              fontSize: "13px",
              lineHeight: "1.55",
              fontFamily: "var(--mono)",
              overflowX: "auto",
              maxWidth: "100%",
              width: "100%",
              boxSizing: "border-box",
            }}
            codeTagProps={{
              style: {
                fontFamily: "var(--mono)",
                background: "transparent",
                whiteSpace: "pre",
                wordBreak: "normal",
                overflowWrap: "normal",
              },
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  return (
    <code
      className="inline-code bg-[#232730] text-[#e6edf3] px-1.5 py-0.5 rounded text-[12px] font-mono border border-[rgba(255,255,255,0.12)] whitespace-pre-wrap break-words"
      {...props}
    >
      {children}
    </code>
  );
});

const customMarkdownComponents = {
  pre: PreBlock,
  code: CodeBlock,
  img: ({ src, alt }: any) => <ImageCard src={src} alt={alt} />,
  a: ({ href, children }: any) => {
    if (
      href &&
      (href.startsWith("data:audio/") ||
        href.endsWith(".wav") ||
        href.endsWith(".mp3") ||
        href.endsWith(".m4a") ||
        href.endsWith(".ogg"))
    ) {
      return <AudioPlayerCard src={href} title={typeof children === "string" ? children : "Audio Response"} />;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline hover:opacity-80">
        {children}
      </a>
    );
  },
};

export interface ParsedReasoning {
  hasReasoning: boolean;
  reasoningText: string;
  isStreamingReasoning: boolean;
  mainContent: string;
}

export function parseReasoning(content: string): ParsedReasoning {
  if (!content) {
    return {
      hasReasoning: false,
      reasoningText: "",
      isStreamingReasoning: false,
      mainContent: "",
    };
  }

  let text = content;
  const reasoningParts: string[] = [];
  let isStreamingReasoning = false;

  // 1. Extract and clean all closed <think>...</think> blocks
  const thinkBlockRegex = /<think>([\s\S]*?)<\/think>/gi;
  let match: RegExpExecArray | null;

  while ((match = thinkBlockRegex.exec(text)) !== null) {
    const rawReasoning = match[1] || "";
    // Clean any nested/duplicate think tags inside the matched reasoning
    const cleaned = rawReasoning.replace(/<\/?think>/gi, "").trim();
    if (cleaned) {
      reasoningParts.push(cleaned);
    }
  }

  // Remove the matched closed blocks from text
  text = text.replace(thinkBlockRegex, "");

  // 2. Check for an unclosed trailing <think> block (active streaming)
  const openThinkIndex = text.indexOf("<think>");
  if (openThinkIndex !== -1) {
    const beforeOpen = text.substring(0, openThinkIndex);
    const afterOpen = text.substring(openThinkIndex + 7);
    const cleanedActive = afterOpen.replace(/<\/?think>/gi, "").trim();
    if (cleanedActive) {
      reasoningParts.push(cleanedActive);
    }
    isStreamingReasoning = true;
    text = beforeOpen;
  }

  // 3. Clean any orphaned <think> or </think> tags from the remaining main content
  const cleanedMain = text.replace(/<\/?think>/gi, "").trim();
  const fullReasoningText = reasoningParts.join("\n\n").trim();

  return {
    hasReasoning: fullReasoningText.length > 0 || isStreamingReasoning,
    reasoningText: fullReasoningText,
    isStreamingReasoning,
    mainContent: cleanedMain,
  };
}

export const MessageRenderer = memo(({ content }: { content: string }) => {
  if (!content) return null;

  // 1. Direct image extraction to prevent heavy markdown/math regex backtracking on multi-megabyte base64 strings
  const imgStart = content.indexOf("![");
  if (imgStart !== -1) {
    const parenStart = content.indexOf("](", imgStart);
    const parenEnd = content.indexOf(")", parenStart);
    if (parenStart !== -1 && parenEnd !== -1) {
      const src = content.substring(parenStart + 2, parenEnd);
      if (src.startsWith("data:image/") || src.startsWith("http") || src.startsWith("asset:") || src.startsWith("file:")) {
        const textBefore = content.substring(0, imgStart).trim();
        const alt = content.substring(imgStart + 2, parenStart);
        const textAfter = content.substring(parenEnd + 1).trim();

        return (
          <div className="flex flex-col gap-1.5 w-full">
            {textBefore && <MessageRenderer content={textBefore} />}
            <ImageCard alt={alt} src={src} />
            {textAfter && <MessageRenderer content={textAfter} />}
          </div>
        );
      }
    }
  }

  // 2. Direct audio response extraction
  const trimmed = content.trim();
  if (trimmed.startsWith("[Audio Response](") && trimmed.endsWith(")")) {
    const src = trimmed.substring(17, trimmed.length - 1);
    return <AudioPlayerCard src={src} title="Audio Response" />;
  }

  // 3. Normal reasoning and Markdown rendering flow
  const { hasReasoning, reasoningText, isStreamingReasoning, mainContent } = parseReasoning(content);

  if (hasReasoning) {
    return (
      <>
        <details className="mb-4" open={isStreamingReasoning}>
          <summary className="cursor-pointer text-xs font-semibold text-[#8b949e] mb-2 select-none hover:text-[#c9d1d9] transition-colors outline-none list-none flex items-center gap-2">
            {isStreamingReasoning ? (
              <span className="flex items-center gap-2">
                <Sparkles size={12} className="animate-pulse text-[#d2a8ff]" /> Reasoning...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={12} className="text-[#8b949e]" /> View Reasoning
              </span>
            )}
          </summary>
          {reasoningText && (
            <div className="pl-3 border-l-2 border-[#30363d] text-[#8b949e] text-[13px] leading-relaxed italic mb-4 whitespace-pre-wrap font-sans">
              {reasoningText}
            </div>
          )}
        </details>

        {mainContent && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={customMarkdownComponents}
          >
            {mainContent}
          </ReactMarkdown>
        )}
      </>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={customMarkdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
});

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Sparkles } from "lucide-react";
import { useState } from "react";

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group my-4 rounded-md overflow-hidden bg-[#1d1f21]">
        <div className="flex items-center justify-between px-4 py-1 bg-[#2d2f31] text-xs text-gray-400">
          <span>{match[1]}</span>
          <button onClick={handleCopy} className="hover:text-white transition-colors">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <SyntaxHighlighter
          style={atomDark as any}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, background: "transparent" }}
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }
  return <code className="bg-black/10 rounded px-1 py-0.5 text-sm" {...props}>{children}</code>;
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

export const MessageRenderer = ({ content }: { content: string }) => {
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
            components={{ code: CodeBlock }}
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
      components={{ code: CodeBlock }}
    >
      {content}
    </ReactMarkdown>
  );
};


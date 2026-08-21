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

export const MessageRenderer = ({ content }: { content: string }) => {
  const thinkStartIndex = content.indexOf('<think>');
  
  if (thinkStartIndex !== -1) {
    const thinkEndIndex = content.indexOf('</think>', thinkStartIndex);
    const beforeThink = content.substring(0, thinkStartIndex);
    let thinkContent = '';
    let afterThink = '';
    
    if (thinkEndIndex !== -1) {
      thinkContent = content.substring(thinkStartIndex + 7, thinkEndIndex).trim();
      afterThink = content.substring(thinkEndIndex + 8).trim();
    } else {
      thinkContent = content.substring(thinkStartIndex + 7).trim();
    }
    
    return (
      <>
        {beforeThink && (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ code: CodeBlock }}>
            {beforeThink}
          </ReactMarkdown>
        )}
        <details className="mb-4" open={thinkEndIndex === -1}>
          <summary className="cursor-pointer text-xs font-semibold text-[#8b949e] mb-2 select-none hover:text-[#c9d1d9] transition-colors outline-none list-none flex items-center gap-2">
            {thinkEndIndex === -1 ? (
              <span className="flex items-center gap-2"><Sparkles size={12} className="animate-pulse text-[#d2a8ff]" /> Reasoning...</span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles size={12} className="text-[#8b949e]" /> View Reasoning</span>
            )}
          </summary>
          <div className="pl-3 border-l-2 border-[#30363d] text-[#8b949e] text-[13px] leading-relaxed italic mb-4 whitespace-pre-wrap font-sans">
            {thinkContent}
          </div>
        </details>
        {afterThink && (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ code: CodeBlock }}>
            {afterThink}
          </ReactMarkdown>
        )}
      </>
    );
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ code: CodeBlock }}>
      {content}
    </ReactMarkdown>
  );
};


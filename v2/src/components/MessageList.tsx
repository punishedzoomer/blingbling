import { Pencil, FileText, ChevronDown } from "lucide-react";
import { MessageRenderer } from "./MarkdownRenderer";

export function MessageList({ messages, showContextState, setShowContextState, setInput, setPendingContextText, setPendingSnips, setPreviewImage, isThinking }: any) {
  return (
              <div id="messages">
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--tx-mut)" }}>
                    <h3 style={{ color: "var(--tx-1)", fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>Hi There!</h3>
                    <p style={{ fontSize: "13px", lineHeight: 1.5 }}>How can I help you today? Try taking a snip of your screen or asking a question.</p>
                  </div>
                )}
                {messages.map((msg: any, idx: any) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div className={msg.role === "user" ? "user-bubble" : "ai-text small"} >
                      {msg.role === "user" ? (
                        <div>{msg.content}</div>
                      ) : (
                        <MessageRenderer content={msg.content} />
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div style={{ alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: showContextState[idx] ? '8px' : '0' }}>
                            <button
                               onClick={() => {
                                 setInput(msg.content);
                                 setPendingContextText(msg.contextText || "");
                                 setPendingSnips(msg.contextImages ? [...msg.contextImages] : []);
                               }}
                               className="smart-pill"
                               style={{ opacity: 0.6, background: 'rgba(255, 255, 255, 0.05)', borderColor: 'transparent', color: 'var(--tx-mut)' }}
                               title="Edit Prompt"
                            >
                              <span className="ic"><Pencil size={12} /></span>
                            </button>
                            {(msg.contextText || msg.contextImages?.length) && (
                                <button
                                   onClick={() => setShowContextState((prev: any) => ({ ...prev, [idx]: !prev[idx] }))}
                                   className="smart-pill"
                                   style={{ opacity: 0.6, background: 'rgba(255, 255, 255, 0.05)', borderColor: 'transparent', color: 'var(--tx-mut)' }}
                                >
                                  <span className="ic"><FileText size={12} /></span>
                                  <span>View Context</span>
                                  <span className="ic" style={{ marginLeft: "4px", transform: showContextState[idx] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><ChevronDown size={12} /></span>
                                </button>
                            )}
                        </div>
                        {showContextState[idx] && (msg.contextText || msg.contextImages?.length) && (
                           <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', maxWidth: '90%', alignSelf: 'flex-end' }}>
                             {msg.contextText && (
                               <pre style={{ marginBottom: msg.contextImages?.length ? '12px' : 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '11px', color: 'var(--tx-2)', fontFamily: 'monospace' }}>
                                 {msg.contextText}
                               </pre>
                             )}
                             {msg.contextImages && msg.contextImages.length > 0 && (
                               <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                                  {msg.contextImages.map((img: string, i: number) => (
                                     <div key={i} style={{ flexShrink: 0, cursor: 'zoom-in' }} onClick={() => setPreviewImage(img)}>
                                        <img src={img} style={{ height: '40px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} alt="Context attachment" />
                                     </div>
                                  ))}
                               </div>
                             )}
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isThinking && (
                  <div className="ai-text small text-gray-400 italic flex items-center gap-2 px-3 py-2">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                )}
              </div>
  );
}

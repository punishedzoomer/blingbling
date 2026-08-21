import { Zap, Sparkles, Flame, ChevronDown, Scissors, Monitor, History, Plus, Settings, Square, ArrowUp } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function ComposerBottom({ aiMode, setAiMode, showModeDropdown, setShowModeDropdown, pendingSnips, showSnipsTray, setShowSnipsTray, handleSnip, isCapturing, isStreaming, setSessionId, setMessages, setInput, setPendingSnips, setPendingContextText, setActiveTagId, setSessionTitle, handleSend, input }: any) {
  return (
                <div id="composer-bottom">
                  <div style={{ position: "relative" }}>
                    <button
                      id="ai-mode-toggle"
                      className="smart-pill"
                      disabled={isStreaming}
                      onClick={() => setShowModeDropdown(!showModeDropdown)}
                      title="Select AI Mode"
                    >
                      <span className="ic">
                        {aiMode === "quick" && <Zap size={14} />}
                        {aiMode === "smart" && <Sparkles size={14} />}
                        {aiMode === "ultra" && <Flame size={14} />}
                      </span>
                      <span>
                        {aiMode === "quick" && "Quick"}
                        {aiMode === "smart" && "Smart"}
                        {aiMode === "ultra" && "Ultra"}
                      </span>
                      <span className="ic" style={{ marginLeft: "2px" }}><ChevronDown size={14} /></span>
                    </button>

                    {showModeDropdown && (
                      <>
                        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setShowModeDropdown(false)} />
                        <div className="mode-menu">
                          {aiMode !== "quick" && (
                            <button className="mode-menu-item" onClick={() => { setAiMode("quick"); setShowModeDropdown(false); }}>
                              <Zap size={14} /> Quick
                            </button>
                          )}
                          {aiMode !== "smart" && (
                            <button className="mode-menu-item" onClick={() => { setAiMode("smart"); setShowModeDropdown(false); }}>
                              <Sparkles size={14} /> Smart
                            </button>
                          )}
                          {aiMode !== "ultra" && (
                            <button className="mode-menu-item" onClick={() => { setAiMode("ultra"); setShowModeDropdown(false); }}>
                              <Flame size={14} /> Ultra
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <button id="snip-interactive-btn" className="smart-pill" title="Snip Region" onClick={() => { if (pendingSnips.length > 0) setShowSnipsTray(!showSnipsTray); else handleSnip(true); }} disabled={isCapturing || isStreaming} style={{ marginLeft: '8px', color: pendingSnips.length > 0 ? 'var(--accent)' : undefined, borderColor: pendingSnips.length > 0 ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : undefined }}>
                    <span className="ic"><Scissors size={14} /></span>
                    <span>{pendingSnips.length > 0 ? `${pendingSnips.length} Snip${pendingSnips.length > 1 ? 's' : ''}` : 'Snip'}</span>
                  </button>
                  <button id="snip-full-btn" className="smart-pill" title="Capture Entire Screen" onClick={() => handleSnip(false)} disabled={isCapturing || isStreaming} style={{ marginLeft: '4px' }}>
                    <span className="ic"><Monitor size={14} /></span>
                  </button>
                  <button id="history-btn" className="history-btn" title="View conversation history" disabled={isStreaming} onClick={async () => {
                                        await invoke("show_panel", { label: "history" }).catch(() => {
                      alert("Could not open History window. Please restart the app for the multi-window update to take effect!");
                    });
                  }}>
                    <span className="ic"><History size={16} /></span>
                  </button>
                  <button id="new-chat-btn" className="history-btn" title="New Chat" disabled={isStreaming} onClick={() => {
                    setSessionId(Date.now().toString());
                    setMessages([]);
                    setInput("");
                    setPendingSnips([]);
                    setPendingContextText("");
                    setActiveTagId(null);
                    setSessionTitle(null);
                  }} style={{ marginLeft: '4px' }}>
                    <span className="ic"><Plus size={16} /></span>
                  </button>
                  <button id="more-btn" className="more-btn" title="Settings" disabled={isStreaming} onClick={async () => {
                                        await invoke("show_panel", { label: "settings" }).catch(() => {
                      alert("Could not open Settings window. Please restart the app!");
                    });
                  }}>
                    <span className="ic"><Settings size={16} /></span>
                  </button>
                  <div className="spacer"></div>
                  <button 
                    id="send-btn" 
                    title={isStreaming ? "Stop" : "Send"} 
                    onClick={isStreaming ? async () => {
                                            await invoke("cancel_ai_response");
                    } : handleSend} 
                    disabled={!isStreaming && (!input.trim() && pendingSnips.length === 0)}
                  >
                    {isStreaming ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} />}
                  </button>
                </div>
              
  );
}

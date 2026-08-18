import re

with open("v2/src/SettingsApp.tsx", "r") as f:
    content = f.read()

# 1. Update imports
import_old = 'import { Settings, Zap, Sparkles, Flame, ChevronDown, Search, MessageCircle, LayoutTemplate, Terminal } from "lucide-react";'
import_new = 'import { Settings, Zap, Sparkles, Flame, ChevronDown, Search, MessageCircle, LayoutTemplate, Terminal, Plus, Trash2, ArrowLeft, Layers, Paperclip } from "lucide-react";'
content = content.replace(import_old, import_new)

# 2. Inject states
state_injection = """
  const [workflows, setWorkflows] = useState<any[]>(() => {
    const saved = localStorage.getItem("customWorkflows");
    return saved ? JSON.parse(saved) : [];
  });
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  const saveWorkflows = (newWorkflows: any[]) => {
    setWorkflows(newWorkflows);
    localStorage.setItem("customWorkflows", JSON.stringify(newWorkflows));
  };
"""
# find the place where buttons state is
btn_state = """  const saveButtons = (newButtons: any) => {
    setButtons(newButtons);
    localStorage.setItem("buttonConfigs", JSON.stringify(newButtons));
  };"""
content = content.replace(btn_state, btn_state + "\n" + state_injection)

# 3. Rename Advanced tab to Workflows
tab_old = """            <button className={`s-tab ${activeTab === 'advanced' ? 'on' : ''}`} onClick={() => setActiveTab('advanced')} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <LayoutTemplate size={14} style={{ marginRight: "6px" }} /> Advanced
            </button>"""
tab_new = """            <button className={`s-tab ${activeTab === 'advanced' ? 'on' : ''}`} onClick={() => { setActiveTab('advanced'); setEditingWorkflowId(null); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={14} style={{ marginRight: "6px" }} /> Workflows
            </button>"""
content = content.replace(tab_old, tab_new)

# 4. Replace Advanced tab content
body_old = """            {activeTab === 'advanced' && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", color: "var(--tx-mut)", fontSize: "13px" }}>
                Advanced settings coming soon...
              </div>
            )}"""

body_new = """            {activeTab === 'advanced' && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
                {!editingWorkflowId ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "12px", color: "var(--tx-2)", lineHeight: "1.5" }}>
                        Create custom color-coded workflows.
                      </div>
                      <button 
                        onClick={() => {
                          const newId = Date.now().toString();
                          const newWf = { id: newId, name: "New Workflow", color: "#3c83f5", prompt: "", attachments: [] };
                          saveWorkflows([...workflows, newWf]);
                          setEditingWorkflowId(newId);
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "var(--accent)", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
                      >
                        <Plus size={14} /> Create
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", flex: 1 }}>
                      {workflows.length === 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px", color: "var(--tx-mut)", fontSize: "13px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.1)" }}>
                          No workflows created yet.
                        </div>
                      )}
                      {workflows.map(wf => (
                        <div 
                          key={wf.id} 
                          onClick={() => setEditingWorkflowId(wf.id)}
                          style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", cursor: "pointer", borderLeft: `4px solid ${wf.color}` }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        >
                          <span style={{ fontSize: "14px", color: "var(--tx-1)", fontWeight: 500, flex: 1 }}>{wf.name}</span>
                          <span style={{ fontSize: "12px", color: "var(--tx-mut)" }}>Edit</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (() => {
                  const wf = workflows.find(w => w.id === editingWorkflowId);
                  if (!wf) return null;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <button 
                          onClick={() => setEditingWorkflowId(null)}
                          style={{ background: "transparent", border: "none", color: "var(--tx-mut)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", borderRadius: "6px" }}
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--tx-1)", flex: 1 }}>Edit Workflow</div>
                        <button 
                          onClick={() => {
                            saveWorkflows(workflows.filter(w => w.id !== editingWorkflowId));
                            setEditingWorkflowId(null);
                          }}
                          style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "6px", borderRadius: "6px" }}
                          title="Delete Workflow"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="s-label" style={{ fontSize: "11px", color: "var(--tx-mut)" }}>Workflow Name</label>
                        <input 
                          type="text" 
                          value={wf.name}
                          onChange={(e) => {
                            const newWf = [...workflows];
                            const idx = newWf.findIndex(w => w.id === editingWorkflowId);
                            newWf[idx].name = e.target.value;
                            saveWorkflows(newWf);
                          }}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "var(--tx-1)", fontSize: "13px" }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="s-label" style={{ fontSize: "11px", color: "var(--tx-mut)" }}>Accent Color</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {['#3c83f5', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                            <div 
                              key={color}
                              onClick={() => {
                                const newWf = [...workflows];
                                const idx = newWf.findIndex(w => w.id === editingWorkflowId);
                                newWf[idx].color = color;
                                saveWorkflows(newWf);
                              }}
                              style={{ width: "24px", height: "24px", borderRadius: "50%", background: color, cursor: "pointer", border: wf.color === color ? "2px solid #fff" : "2px solid transparent", transition: "all 0.2s" }}
                            />
                          ))}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                        <label className="s-label" style={{ fontSize: "11px", color: "var(--tx-mut)" }}>System Prompt</label>
                        <textarea 
                          value={wf.prompt}
                          onChange={(e) => {
                            const newWf = [...workflows];
                            const idx = newWf.findIndex(w => w.id === editingWorkflowId);
                            newWf[idx].prompt = e.target.value;
                            saveWorkflows(newWf);
                          }}
                          placeholder="e.g. You are an expert coding assistant..."
                          style={{ width: "100%", flex: 1, minHeight: "80px", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "var(--tx-1)", fontSize: "13px", resize: "none" }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label className="s-label" style={{ fontSize: "11px", color: "var(--tx-mut)" }}>Custom Attachments</label>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", color: "var(--tx-mut)", fontSize: "12px", cursor: "pointer" }}>
                          <Paperclip size={14} /> Add File/Vault (Coming Soon)
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>
            )}"""
content = content.replace(body_old, body_new)

with open("v2/src/SettingsApp.tsx", "w") as f:
    f.write(content)

print("Updated Workflows UI in SettingsApp.tsx")

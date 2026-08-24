const { invoke } = window.__TAURI__.core;
async function spam() {
  for (let i=0; i<20; i++) {
    await invoke("set_app_mode", { mode: "windowed" });
    await new Promise(r => setTimeout(r, 100));
    await invoke("set_app_mode", { mode: "widget" });
    await new Promise(r => setTimeout(r, 100));
  }
}
spam();

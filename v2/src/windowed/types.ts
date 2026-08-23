export type Surface = "chat" | "history" | "notebook" | "settings" | "tutorial";

export interface NavItemConfig {
  id: Surface;
  label: string;
}

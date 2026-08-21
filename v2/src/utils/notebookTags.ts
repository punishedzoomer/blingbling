export interface Tag {
  id: string;
  name: string;
  color: string;
  notebookId?: number;
}

export function syncNotebookTag(notebook: { id: number; title: string; color?: string }): Tag {
  try {
    const customTagsStr = localStorage.getItem("customTags") || "[]";
    const tags: Tag[] = JSON.parse(customTagsStr);

    let tag = tags.find(
      (t) => t.notebookId === notebook.id || t.name.toLowerCase() === notebook.title.toLowerCase()
    );

    if (tag) {
      tag.name = notebook.title;
      if (notebook.color) tag.color = notebook.color;
      tag.notebookId = notebook.id;
    } else {
      tag = {
        id: `nb_${notebook.id}`,
        name: notebook.title,
        color: notebook.color || "#3B82F6",
        notebookId: notebook.id,
      };
      tags.push(tag);
    }

    localStorage.setItem("customTags", JSON.stringify(tags));
    return tag;
  } catch (e) {
    console.error("Failed to sync notebook tag:", e);
    return {
      id: `nb_${notebook.id}`,
      name: notebook.title,
      color: notebook.color || "#3B82F6",
      notebookId: notebook.id,
    };
  }
}

export function getNotebookTagById(notebookId: number): Tag | null {
  try {
    const customNotebooksStr = localStorage.getItem("customNotebooks") || "[]";
    const notebooks = JSON.parse(customNotebooksStr);
    const found = notebooks.find((nb: any) => nb.id === notebookId);
    if (found) {
      return syncNotebookTag(found);
    }

    const customTagsStr = localStorage.getItem("customTags") || "[]";
    const tags: Tag[] = JSON.parse(customTagsStr);
    const existing = tags.find((t) => t.notebookId === notebookId || t.id === `nb_${notebookId}`);
    return existing || null;
  } catch (e) {
    console.error("Failed to get notebook tag by id:", e);
    return null;
  }
}

export function updateNotebookTagName(notebookId: number, oldTitle: string, newTitle: string, color?: string) {
  try {
    const customTagsStr = localStorage.getItem("customTags") || "[]";
    const tags: Tag[] = JSON.parse(customTagsStr);

    const tag = tags.find(
      (t) => t.notebookId === notebookId || t.name.toLowerCase() === oldTitle.toLowerCase()
    );

    if (tag) {
      tag.name = newTitle;
      if (color) tag.color = color;
      tag.notebookId = notebookId;
      localStorage.setItem("customTags", JSON.stringify(tags));
    } else {
      syncNotebookTag({ id: notebookId, title: newTitle, color });
    }
  } catch (e) {
    console.error("Failed to update notebook tag name:", e);
  }
}

/**
 * Shared registry mapping knowledge base name → ID.
 * Populated by the composer when @mentions are configured,
 * consumed by the chat adapter to attach KB IDs to requests.
 */

let nameToId = new Map<string, number>();

export const knowledgeBaseRegistry = {
  /** Replace the entire registry (called when KB list loads). */
  setAll(entries: Array<{ id: number; name: string }>) {
    nameToId = new Map(entries.map((e) => [e.name, e.id]));
  },

  /** Look up IDs for a list of mention labels. */
  getIds(names: string[]): number[] {
    return names
      .map((name) => nameToId.get(name))
      .filter((id): id is number => id !== undefined);
  },
};

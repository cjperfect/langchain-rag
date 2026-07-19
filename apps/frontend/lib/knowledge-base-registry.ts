let nameToId = new Map<string, number>();

export const knowledgeBaseRegistry = {
  setAll(entries: Array<{ id: number; name: string }>) {
    nameToId = new Map(entries.map((e) => [e.name, e.id]));
  },

  getIds(names: string[]): number[] {
    return names.map((name) => nameToId.get(name)).filter((id): id is number => id !== undefined);
  },
};

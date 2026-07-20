let nameToId = new Map<string, number>();
let idToName = new Map<number, string>();

export const knowledgeBaseRegistry = {
  setAll(entries: Array<{ id: number; name: string }>) {
    nameToId = new Map(entries.map((e) => [e.name, e.id]));
    idToName = new Map(entries.map((e) => [e.id, e.name]));
  },

  getIds(names: string[]): number[] {
    return names.map((name) => nameToId.get(name)).filter((id): id is number => id !== undefined);
  },

  /** 根据 ID 反查知识库名称 */
  getName(id: number): string | undefined {
    return idToName.get(id);
  },

  /** 获取所有缓存的 KB 信息 */
  getAll(): Array<{ id: number; name: string }> {
    return Array.from(idToName.entries()).map(([id, name]) => ({ id, name }));
  },
};

/**
 * BM25 分词器（无需 PostgreSQL 中文分词扩展，纯 TS 实现）
 *
 * 英文/数字：整词作为一个 token（转小写）。
 * 中文（含扩展区）：相邻两字组成 bigram（如 "机器" → ["机器"]，"学习机" → ["学习","习机"]）；
 *   索引侧额外补一份单字 unigram，让"猫"这类单字查询也能命中。
 *   bigram 是中文检索的常用折中：不需要词典，切分质量接近分词器，代价是 token 数变多。
 */

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const WORD_RE = /[a-z0-9_]/;

/** 把文本切成 [词段] 序列：CJK 连续段 或 ASCII 单词 */
function scanRuns(text: string): Array<{ type: "cjk" | "word"; run: string }> {
  const s = text.toLowerCase();
  const runs: Array<{ type: "cjk" | "word"; run: string }> = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (CJK_RE.test(ch)) {
      let j = i;
      while (j < s.length && CJK_RE.test(s[j])) j++;
      runs.push({ type: "cjk", run: s.slice(i, j) });
      i = j;
    } else if (WORD_RE.test(ch)) {
      let j = i;
      while (j < s.length && WORD_RE.test(s[j])) j++;
      runs.push({ type: "word", run: s.slice(i, j) });
      i = j;
    } else {
      i++;
    }
  }
  return runs;
}

function bigrams(run: string): string[] {
  const out: string[] = [];
  for (let x = 0; x + 1 < run.length; x++) out.push(run.slice(x, x + 2));
  return out;
}

/** 索引侧分词：CJK 段 = unigrams + bigrams；ASCII 段 = 整词 */
export function tokenizeForIndex(text: string): string[] {
  const tokens: string[] = [];
  for (const { type, run } of scanRuns(text)) {
    if (type === "word") {
      tokens.push(run);
    } else if (run.length === 1) {
      tokens.push(run);
    } else {
      tokens.push(...run.split(""), ...bigrams(run));
    }
  }
  return tokens;
}

/** 查询侧分词：多字 CJK 段只取 bigrams（更精准），单字段退化为 unigram；结果去重 */
export function tokenizeQuery(text: string): string[] {
  const set = new Set<string>();
  for (const { type, run } of scanRuns(text)) {
    if (type === "word") {
      set.add(run);
    } else if (run.length === 1) {
      set.add(run);
    } else {
      for (const bg of bigrams(run)) set.add(bg);
    }
  }
  return [...set];
}

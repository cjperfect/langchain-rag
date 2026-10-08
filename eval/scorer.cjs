/**
 * 评测打分器（纯函数，不依赖任何外部服务）
 *
 * 命中判定：检索结果里有没有切片满足
 *   - 文档名包含 expect_doc（不填则不限定文档）
 *   - 切片内容包含 expect_section 字符串；或 expect_keywords 数组里任一关键词
 *
 * 为什么不用"人工标注 chunk 编号"：重建索引后 chunk 编号全变，软匹配让 QA 集长期稳定。
 */

/** 在检索结果里找到第一个命中切片的名次（0 起），未命中返回 -1 */
function findHitRank(item, results) {
  return results.findIndex((r) => {
    // 文档名匹配
    const docOk = !item.expect_doc || (r.documentName && r.documentName.includes(item.expect_doc));
    if (!docOk) return false;

    // 内容匹配：expect_section 优先；否则 expect_keywords 任一命中
    if (item.expect_section) {
      return r.content.includes(item.expect_section);
    }
    if (item.expect_keywords && item.expect_keywords.length > 0) {
      return item.expect_keywords.some((kw) => r.content.includes(kw));
    }
    // 没有任何内容标注时，只看文档名（粗匹配，尽量避免）
    return true;
  });
}

/**
 * 给单条题打分
 * @param {object} item golden QA 条目
 * @param {Array} results ragService.search 返回的 top-k
 * @param {number[]} ks 要算 Recall 的 k 值集合（如 [3,5,8]）
 *
 * type=adversarial（陷阱题，文档里没有答案）：
 *   正确表现 = top-k 里没有召回"同文档相关切片"（findHitRank == -1）；
 *   被误导召回了 = 幻觉，得 0 分。
 */
function scoreItem(item, results, ks) {
  const rawRank = findHitRank(item, results);
  const isAdversarial = item.type === "adversarial";
  const hit = isAdversarial ? rawRank === -1 : rawRank >= 0;
  // 对陷阱题统一记 hitRank=-1（语义：没召回相关切片）；正常题记真实名次
  const hitRank = isAdversarial ? -1 : rawRank;
  const out = {
    id: item.id,
    query: item.query,
    type: item.type ?? "text",
    hit,
    hitRank, // -1 = 未命中（陷阱题下 -1 表示正确，没被误导）
    mrr: hit && hitRank >= 0 ? 1 / (hitRank + 1) : 0,
    // 单题 nDCG：理想是排第1（DCG=1），实际排 rank 则 1/log2(rank+2)
    ndcg: hit && hitRank >= 0 ? 1 / Math.log2(hitRank + 2) : 0,
  };
  for (const k of ks) {
    out[`recall@${k}`] = hit && hitRank >= 0 && hitRank < k ? 1 : 0;
  }
  return out;
}

/** 把一批单题分数聚合成整体指标 */
function aggregate(scored, ks) {
  const n = scored.length || 1;
  const summary = { questions: scored.length, hitCount: 0 };
  for (const k of ks) {
    summary[`recall@${k}`] = +(scored.reduce((s, x) => s + x[`recall@${k}`], 0) / n).toFixed(3);
  }
  summary.mrr = +(scored.reduce((s, x) => s + x.mrr, 0) / n).toFixed(3);
  summary.ndcg = +(scored.reduce((s, x) => s + x.ndcg, 0) / n).toFixed(3);
  summary.hitCount = scored.filter((x) => x.hit).length;
  return summary;
}

module.exports = { findHitRank, scoreItem, aggregate };

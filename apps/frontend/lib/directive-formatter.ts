import type {
  Unstable_DirectiveFormatter,
  Unstable_DirectiveSegment,
  Unstable_TriggerItem,
} from "@assistant-ui/react";

const MENTION_RE = /@([^\s@]{1,128})/gu;

/**
 * Custom directive formatter that uses a clean `@label` format
 * instead of the verbose `:type[label]{name=id}` default format.
 *
 * Serializes trigger items as `@label` and parses `@label`
 * patterns back into mention segments.
 */
export const atMentionFormatter: Unstable_DirectiveFormatter = {
  serialize(item: Unstable_TriggerItem): string {
    return `@${item.label ?? item.id}`;
  },

  parse(text: string): readonly Unstable_DirectiveSegment[] {
    const segments: Unstable_DirectiveSegment[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(MENTION_RE)) {
      if (match.index > lastIndex) {
        segments.push({
          kind: "text",
          text: text.slice(lastIndex, match.index),
        });
      }

      const label = match[1]!;
      segments.push({
        kind: "mention",
        type: "mention",
        label,
        id: label,
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({
        kind: "text",
        text: text.slice(lastIndex),
      });
    }

    return segments;
  },
};

"use client";

import { type RefObject, useEffect, useState, useCallback } from "react";
import { useAuiState } from "@assistant-ui/react";
import type { Unstable_DirectiveFormatter, AssistantState } from "@assistant-ui/react";

const selectComposerText = (s: AssistantState) => s.composer.text;

type HighlightOverlayProps = {
  /** Ref to the textarea element to sync scroll position. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Formatter used to parse mention syntax from the composer text. */
  formatter: Unstable_DirectiveFormatter;
};

/**
 * Renders a transparent overlay behind the textarea that displays
 * `@mentions` with green highlight styling. The textarea's text is made
 * transparent so the highlighted overlay shows through.
 */
export function HighlightOverlay({
  textareaRef,
  formatter,
}: HighlightOverlayProps) {
  const text = useAuiState(selectComposerText) ?? "";
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);

  // Sync scroll position and height from the textarea
  const syncFromTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    setHeight(el.clientHeight);
  }, [textareaRef]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    syncFromTextarea();

    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(syncFromTextarea);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [syncFromTextarea]);

  const segments = formatter.parse(text);

  return (
    <div
      data-slot="highlight-overlay"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-1 text-base leading-[1.5rem] whitespace-pre-wrap break-words select-none"
      style={{
        minHeight: height > 0 ? `${height}px` : undefined,
      }}
    >
      <div
        className="w-full"
        style={{
          transform: `translateY(-${scrollTop}px)`,
        }}
      >
        {segments.map((seg, i) =>
          seg.kind === "mention" ? (
            <span
              key={i}
              data-slot="highlight-overlay-mention"
              className="text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/40 rounded-3xl -mx-0.5 py-1 px-2"
            >
              @{seg.label}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {/* Zero-width space ensures the container has at least one line */}
        {"​"}
      </div>
    </div>
  );
}

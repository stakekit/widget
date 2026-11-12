import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { color } from "../tokens/color.stylex";

type Marker = (text: string) => ReactNode;

const unchangedText: Marker = (text) => text;

/** Escapes every pattern syntax character, so a term matches literally. */
const literal = (term: string) => term.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");

/**
 * Marks each whitespace-separated term of `query` wherever it occurs,
 * case-insensitively, as typed: no other folding. The patterns run on the
 * text itself, so the marked runs keep its characters and their indices.
 */
export const createSearchHighlighter = (query: string | undefined): Marker => {
  const terms = new Set(query?.match(/\S+/g) ?? []);
  if (terms.size === 0) return unchangedText;
  const patterns = Array.from(
    terms,
    (term) => new RegExp(literal(term), "giu")
  );

  return (text) => {
    const ranges: Array<readonly [number, number]> = [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
        ranges.push([match.index, match.index + match[0].length]);
        // From the next character, so occurrences that overlap all count.
        pattern.lastIndex =
          match.index + ((text.codePointAt(match.index) ?? 0) > 0xffff ? 2 : 1);
      }
    }
    if (ranges.length === 0) return text;
    ranges.sort((a, b) => a[0] - b[0]);

    const parts: Array<ReactNode> = [];
    let at = 0;
    let runStart = -1;
    let runEnd = -1;
    const flush = () => {
      if (runStart === -1) return;
      if (runStart > at) parts.push(text.slice(at, runStart));
      parts.push(
        <mark key={runStart} {...stylex.props(styles.mark)}>
          {text.slice(runStart, runEnd)}
        </mark>
      );
      at = runEnd;
    };
    // Overlapping and touching matches, of one term or several, join.
    for (const [start, end] of ranges) {
      if (start <= runEnd) {
        runEnd = Math.max(runEnd, end);
      } else {
        flush();
        runStart = start;
        runEnd = end;
      }
    }
    flush();
    if (at < text.length) parts.push(text.slice(at));
    return parts;
  };
};

const styles = stylex.create({
  // A tint and the accent's text color, so a match still reads on a chosen
  // row's own accent tint.
  mark: {
    backgroundColor: color.accentSoft,
    color: color.accentText,
  },
});

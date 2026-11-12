import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { color } from "../tokens/color.stylex";

/** Escapes every pattern syntax character, so a term matches literally. */
const escapeRegExp = (term: string) =>
  term.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");

/**
 * `text` with each whitespace-separated term of `query` marked wherever it
 * occurs, ignoring case. The marked runs keep the text's own characters.
 */
export const highlightMatches = (
  text: string,
  query: string | undefined
): ReactNode => {
  const terms = query?.match(/\S+/g);
  if (!terms) return text;
  // Longest first, so "staked" wins over "st" where both match.
  const pattern = new RegExp(
    `(${terms
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|")})`,
    "iu"
  );
  // The capture group puts every match at an odd index.
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} {...stylex.props(styles.mark)}>
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const styles = stylex.create({
  // A tint and the accent's text color, so a match still reads on a chosen
  // row's own accent tint.
  mark: {
    backgroundColor: color.accentSoft,
    color: color.accentText,
  },
});

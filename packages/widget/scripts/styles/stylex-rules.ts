/**
 * Counts StyleX's atomic rules in a stylesheet: the Widget's `sk` class prefix
 * and a lowercase base-36 hash, such as `.sk1e2nbdu{` or `.skju2f9n:not(#\#)`.
 * StyleX's markers carry a dash (`sk-default-marker`), so they do not count.
 */
export const countStyleXRules = (css: string): number =>
  css.match(/\.sk[0-9a-z]{5,}[\s{:,.[]/g)?.length ?? 0;

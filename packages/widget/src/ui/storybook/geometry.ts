/**
 * For stories only: layout facts a play test asserts, read from the rendered
 * boxes rather than from class names or token values.
 */

/** Whether the text runs on one line: one box, under two line heights. */
export const isOneLine = (element: Element) => {
  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
  return (
    element.getClientRects().length === 1 &&
    element.getBoundingClientRect().height < lineHeight * 2
  );
};

/** Whether the text is cut with an ellipsis: its content overflows its box. */
export const isTruncated = (element: Element) =>
  element.scrollWidth > element.clientWidth;

/**
 * The box the element's outline draws in: its border box grown by the
 * outline's offset and width, or `undefined` while it draws none.
 */
export const outlineBox = (element: Element) => {
  const style = getComputedStyle(element);
  if (style.outlineStyle === "none") return undefined;
  const spread =
    Number.parseFloat(style.outlineOffset) +
    Number.parseFloat(style.outlineWidth);
  const box = element.getBoundingClientRect();
  return {
    top: box.top - spread,
    right: box.right + spread,
    bottom: box.bottom + spread,
    left: box.left - spread,
  };
};

type Edges = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

/** Whether `inner` lies wholly within `outer`. */
export const isWithin = (inner: Edges, outer: Edges) =>
  inner.top >= outer.top &&
  inner.right <= outer.right &&
  inner.bottom <= outer.bottom &&
  inner.left >= outer.left;

/** Whether the element draws an outline, and it lies wholly within `outer`. */
export const outlineWithin = (element: Element, outer: Edges) => {
  const outline = outlineBox(element);
  return outline !== undefined && isWithin(outline, outer);
};

/** The box a scrolling element clips its content to: inside its scrollbar. */
export const viewportBox = (element: Element) => {
  const box = element.getBoundingClientRect();
  const top = box.top + element.clientTop;
  const left = box.left + element.clientLeft;
  return {
    top,
    right: left + element.clientWidth,
    bottom: top + element.clientHeight,
    left,
  };
};

/** Whether two boxes share a line: each one's middle lies within the other. */
export const shareLine = (first: Element, second: Element) => {
  const a = first.getBoundingClientRect();
  const b = second.getBoundingClientRect();
  const middle = (box: DOMRect) => (box.top + box.bottom) / 2;
  return (
    middle(a) >= b.top &&
    middle(a) <= b.bottom &&
    middle(b) >= a.top &&
    middle(b) <= a.bottom
  );
};

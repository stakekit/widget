import type { ReactNode } from "react";

/**
 * For stories only: a size container of a fixed width, as the Widget root is,
 * so a story shows a responsive value at a chosen container size.
 */
export const ContainerFrame = ({
  width,
  children,
}: {
  readonly width: number;
  readonly children: ReactNode;
}) => <div style={{ containerType: "inline-size", width }}>{children}</div>;

/**
 * For stories only: a block as wide as the viewport, out past the canvas's
 * padding, as the page is on a phone that gives the Widget all of its width.
 */
export const FullBleed = ({ children }: { readonly children: ReactNode }) => (
  <div style={{ width: "100vw", marginInlineStart: "calc(50% - 50vw)" }}>
    {children}
  </div>
);

/**
 * For stories only: the two elements a story renders in a narrow frame and
 * then a wide one. Throws unless there are exactly two.
 */
export const narrowAndWide = (
  elements: ReadonlyArray<HTMLElement>
): readonly [narrow: HTMLElement, wide: HTMLElement] => {
  const [narrow, wide, ...rest] = elements;
  if (narrow === undefined || wide === undefined || rest.length > 0) {
    throw new Error(
      `Expected a narrow and a wide element, got ${elements.length}`
    );
  }
  return [narrow, wide];
};

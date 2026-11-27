import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import { Grid, SplitView, WidgetFrame } from "../../../src/ui/index";
import { type RenderResult, render } from "../../utils/test-utils";

// A wide frame holding a split view, in a host box of the given width. The
// secondary pane is taller than the frame's least height, so the frame's
// height changes as the view splits and stacks.
const renderInFrame = (width: number, hostStyle?: CSSProperties) =>
  render(
    <div style={hostStyle}>
      <div data-testid="host" style={{ width }}>
        <WidgetFrame width="wide" poweredByLabel="Powered by" brandName="Yield">
          <SplitView
            primary={<p data-testid="primary">Amount</p>}
            secondary={
              <p data-testid="secondary" style={{ height: 1200 }}>
                Details
              </p>
            }
            secondaryLabel="Details"
          />
        </WidgetFrame>
      </div>
    </div>
  );

const isSplit = (screen: RenderResult) => {
  const primaryRect = screen
    .getByTestId("primary")
    .element()
    .getBoundingClientRect();
  const secondaryRect = screen
    .getByTestId("secondary")
    .element()
    .getBoundingClientRect();
  return (
    secondaryRect.left >= primaryRect.right &&
    secondaryRect.top === primaryRect.top
  );
};

const resizeHost = (screen: RenderResult, width: number) => {
  const host = screen.getByTestId("host").element();
  if (host instanceof HTMLElement) host.style.width = `${width}px`;
};

const nextFrame = () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());
  return promise;
};

describe("SplitView in a WidgetFrame", () => {
  it.each([
    { width: 959, split: false },
    { width: 959.75, split: false },
    { width: 960, split: true },
    { width: 1000, split: true },
  ])("splits $split in a $width px frame", async ({ width, split }) => {
    const screen = await renderInFrame(width);

    expect(isSplit(screen)).toBe(split);
  });

  // Mounted on the other side of the split size, so the ResizeObserver path
  // marks the frame rather than the mount.
  it.each([
    { from: 1000, width: 959, split: false },
    { from: 900, width: 960, split: true },
  ])(
    "splits $split after resizing from $from px to $width px",
    async ({ from, width, split }) => {
      const screen = await renderInFrame(from);

      resizeHost(screen, width);

      await expect.poll(() => isSplit(screen)).toBe(split);
    }
  );

  it("follows the frame across the split size as it resizes", async () => {
    const screen = await renderInFrame(1000);
    expect(isSplit(screen)).toBe(true);

    resizeHost(screen, 900);
    await expect.poll(() => isSplit(screen)).toBe(false);

    resizeHost(screen, 1000);
    await expect.poll(() => isSplit(screen)).toBe(true);
  });

  // A host page whose error reporting listens on the window would log every
  // crossing of the split size.
  it("crosses the split size without a ResizeObserver loop error", async () => {
    const errors: string[] = [];
    const record = (event: ErrorEvent) => errors.push(event.message);
    window.addEventListener("error", record);
    try {
      const screen = await renderInFrame(1000);

      resizeHost(screen, 900);
      await expect.poll(() => isSplit(screen)).toBe(false);
      await nextFrame();
      resizeHost(screen, 1000);
      await expect.poll(() => isSplit(screen)).toBe(true);
      await nextFrame();
      await nextFrame();
    } finally {
      window.removeEventListener("error", record);
    }

    expect(errors).toEqual([]);
  });

  // A host that zooms its page draws the frame at another size on screen;
  // the split still reads the frame's CSS width, as the frame's layout does.
  // Chromium's CSS `zoom` does not scale container queries the way Safari's
  // page zoom does (WebKit bug 319197), so these guard the measurement
  // rather than reproduce the Safari bug; "Grid split columns" below covers
  // a container query that disagrees with the frame.
  it.each([
    { zoom: 0.75, width: 1000, split: true },
    { zoom: 1.25, width: 900, split: false },
  ])(
    "splits $split in a $width px frame on a host page zoomed to $zoom",
    async ({ zoom, width, split }) => {
      const screen = await renderInFrame(width, { zoom });

      expect(isSplit(screen)).toBe(split);
    }
  );
});

// A split-keyed grid, as the Activity tab lays out its list and details.
const renderGridInFrame = (width: number, paneWidth?: number) =>
  render(
    <div data-testid="host" style={{ width }}>
      <WidgetFrame width="wide" poweredByLabel="Powered by" brandName="Yield">
        {/* A size container narrower than the split size stands in for a
            container query that reads less than the frame's CSS width. */}
        <div
          style={
            paneWidth === undefined
              ? undefined
              : { containerType: "inline-size", width: paneWidth }
          }
        >
          <Grid columns={{ base: 1, split: 2 }}>
            <p data-testid="primary">List</p>
            <p data-testid="secondary">Details</p>
          </Grid>
        </div>
      </WidgetFrame>
    </div>
  );

describe("Grid split columns", () => {
  it.each([
    { width: 900, split: false },
    { width: 1000, split: true },
  ])(
    "uses its split columns $split in a $width px frame",
    async ({ width, split }) => {
      const screen = await renderGridInFrame(width);

      await expect.poll(() => isSplit(screen)).toBe(split);
    }
  );

  it("follows the frame's split, not the nearest container query", async () => {
    const screen = await renderGridInFrame(1000, 700);

    await expect.poll(() => isSplit(screen)).toBe(true);
  });
});

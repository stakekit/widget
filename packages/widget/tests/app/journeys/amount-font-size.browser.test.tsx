import { userEvent } from "vitest/browser";

import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const longAmount = "12345678901234567890123456";
// The integer part stays grouped while typing.
const longAmountText = "12,345,678,901,234,567,890,123,456";

const nextFrame = () => {
  const { promise, resolve } = Promise.withResolvers<number>();
  requestAnimationFrame(resolve);
  return promise;
};

/**
 * Mounts the Widget and types a long amount into the Earn amount, returning
 * the input's font size in pixels before the amount was typed.
 */
const typeLongEarnAmount = async (disableResizingInputFontSize: boolean) => {
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      disableResizingInputFontSize,
    },
  });
  const input = app.getByTestId("number-input");
  await expect.element(input).toBeEnabled();
  const displaySize = Number.parseFloat(
    getComputedStyle(input.element()).fontSize
  );
  await userEvent.click(input);
  await userEvent.keyboard(longAmount);
  await expect.element(input).toHaveValue(longAmountText);
  return { app, displaySize, input: input.element() };
};

describe("Earn amount font size", () => {
  it("steps the type down as a long amount fills the input", async () => {
    const { app, displaySize, input } = await typeLongEarnAmount(false);

    await expect
      .poll(() => Number.parseFloat(getComputedStyle(input).fontSize))
      .toBeLessThan(displaySize);

    await app.unmount();
  });

  it("holds the display size with disableResizingInputFontSize", async () => {
    const { app, displaySize, input } = await typeLongEarnAmount(true);

    // Past the frames in which a resize observer would step the type down.
    await nextFrame();
    await nextFrame();
    expect(Number.parseFloat(getComputedStyle(input).fontSize)).toBe(
      displaySize
    );

    await app.unmount();
  });
});

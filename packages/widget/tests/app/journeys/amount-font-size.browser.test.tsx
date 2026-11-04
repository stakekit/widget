import { userEvent } from "vitest/browser";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const longAmount = "12345678901234567890123456";

const nextFrame = () => {
  const { promise, resolve } = Promise.withResolvers<number>();
  requestAnimationFrame(resolve);
  return promise;
};

/** Mounts the Widget and types a long amount into the Earn amount. */
const typeLongEarnAmount = async (disableResizingInputFontSize: boolean) => {
  const app = await renderApp({
    skProps: {
      apiKey: import.meta.env.VITE_API_KEY,
      disableResizingInputFontSize,
    },
  });
  const input = app.getByTestId("number-input");
  await expect.element(input).toBeEnabled();
  await userEvent.click(input);
  await userEvent.keyboard(longAmount);
  await expect.element(input).toHaveValue(longAmount);
  return { app, input: input.element() };
};

describe("Earn amount font size", () => {
  it("steps the type down as a long amount fills the input", async () => {
    const { app, input } = await typeLongEarnAmount(false);

    await expect.poll(() => getComputedStyle(input).fontSize).not.toBe("32px");

    await app.unmount();
  });

  it("holds the display size with disableResizingInputFontSize", async () => {
    const { app, input } = await typeLongEarnAmount(true);

    // Past the frames in which a resize observer would step the type down.
    await nextFrame();
    await nextFrame();
    expect(getComputedStyle(input).fontSize).toBe("32px");

    await app.unmount();
  });
});

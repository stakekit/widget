import { page, userEvent } from "vitest/browser";

import { formatAddress } from "../../../src/shared/lib/general";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";
import { setup } from "./staking-flow/setup";

type Frame = Readonly<{
  readonly scrollY: number;
  readonly showsEarn: boolean;
}>;

/** Every frame and scroll until `stop`: the window's scroll and the page. */
const recordFrames = () => {
  const frames: Frame[] = [];
  const record = () =>
    frames.push({
      scrollY: window.scrollY,
      showsEarn:
        document.querySelector('[data-testid="number-input"]') !== null,
    });
  const state = { recording: true };
  const onFrame = () => {
    record();
    if (state.recording) requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);
  window.addEventListener("scroll", record);
  return {
    frames,
    stop: () => {
      state.recording = false;
      window.removeEventListener("scroll", record);
    },
  };
};

describe("Navigation scroll reset", () => {
  it("scrolls the window to the top with Review, never showing Earn moved", async ({
    worker,
  }) => {
    // Shorter than the Dashboard, so the window scrolls.
    await page.viewport(1280, 560);
    const { account, customConnectors } = await setup(worker);
    const app = await renderApp({
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        layout: "dashboard",
      },
      walletListFactory: customConnectors,
    });
    await expect
      .element(app.getByText(formatAddress(account)).first())
      .toBeInTheDocument();
    await userEvent.click(app.getByTestId("number-input"));
    await userEvent.keyboard("0.1");

    window.scrollTo(0, document.documentElement.scrollHeight);
    await expect.poll(() => window.scrollY).toBeGreaterThan(0);
    const scrolledTo = window.scrollY;

    const recording = recordFrames();
    await userEvent.click(app.getByRole("button", { name: "Stake" }).last());
    await expect
      .element(app.getByRole("button", { exact: true, name: "Confirm" }))
      .toBeInTheDocument();
    await expect.poll(() => window.scrollY).toBe(0);
    recording.stop();

    expect(
      recording.frames.filter(
        (frame) => frame.showsEarn && frame.scrollY !== scrolledTo
      )
    ).toEqual([]);
  });
});

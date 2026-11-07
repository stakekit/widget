import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { AnimatedNumber } from "./animated-number";
import { Button } from "./button";

const formatFigure = (value: number) => value.toFixed(2);

/**
 * A reward rate that changes when another yield is chosen, on a screen the
 * user can leave and return to.
 */
const RewardRate = ({ rates }: { readonly rates: ReadonlyArray<number> }) => {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);
  return (
    <Stack gap={12} align="start">
      {shown && (
        <Text variant="display" as="p">
          <AnimatedNumber
            value={rates[index] ?? 0}
            format={formatFigure}
            suffix="%"
          />
        </Text>
      )}
      <Stack direction="row" gap={8}>
        <Button
          variant="secondary"
          onClick={() => setIndex((current) => (current + 1) % rates.length)}
        >
          Next yield
        </Button>
        <Button variant="secondary" onClick={() => setShown(!shown)}>
          {shown ? "Leave" : "Return"}
        </Button>
      </Stack>
    </Stack>
  );
};

const meta = {
  title: "Components/AnimatedNumber",
  component: RewardRate,
  args: { rates: [4.21, 12.5, 0.8] },
} satisfies Meta<typeof RewardRate>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The painted figure, which counts; its final value is read separately. */
const figure = (canvasElement: HTMLElement) => {
  const painted = canvasElement.querySelector("[aria-hidden='true']");
  if (painted === null) throw new Error("Expected the painted figure");
  return painted;
};

/** The suffix painted after the counting digits. */
const suffix = (canvasElement: HTMLElement) => {
  const painted = figure(canvasElement).lastElementChild;
  if (painted === null) throw new Error("Expected the painted suffix");
  return painted;
};

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Shows its value at once on mount, then counts to each new value. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(figure(canvasElement)).toHaveTextContent("4.21%");

    await userEvent.click(canvas.getByRole("button", { name: "Next yield" }));
    await waitFor(() =>
      expect(figure(canvasElement)).not.toHaveTextContent("4.21%")
    );
    await waitFor(() =>
      expect(figure(canvasElement)).toHaveTextContent("12.50%")
    );
  },
};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/**
 * Returning to the screen shows the value at once: a remount never replays
 * the count, on any frame.
 */
export const NoCountOnReturn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next yield" }));
    await waitFor(() =>
      expect(figure(canvasElement)).toHaveTextContent("12.50%")
    );
    await userEvent.click(canvas.getByRole("button", { name: "Leave" }));
    await userEvent.click(canvas.getByRole("button", { name: "Return" }));

    for (let frame = 0; frame < 10; frame++) {
      await expect(figure(canvasElement)).toHaveTextContent("12.50%");
      await nextFrame();
    }
  },
};

/** Assistive technology reads the final value, never the steps between. */
export const FinalValueForAssistiveTechnology: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next yield" }));

    const readable = canvas.getByText("12.50%", { ignore: "[aria-hidden]" });
    await expect(readable.closest("[aria-hidden]")).toBeNull();
  },
};

/**
 * Only the digits count: the suffix is one element that keeps its text on
 * every frame, never re-rendered with the digits.
 */
export const StaticSuffix: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const painted = suffix(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Next yield" }));

    const steps = new Set<string>();
    for (let frame = 0; frame < 20; frame++) {
      await nextFrame();
      steps.add(figure(canvasElement).textContent);
      await expect(suffix(canvasElement)).toBe(painted);
      await expect(painted).toHaveTextContent(/^%$/);
      await expect(painted.childNodes).toHaveLength(1);
    }
    await expect(steps.size).toBeGreaterThan(2);
  },
};

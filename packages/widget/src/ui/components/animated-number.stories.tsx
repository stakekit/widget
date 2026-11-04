import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { AnimatedNumber } from "./animated-number";
import { Button } from "./button";

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

/** A reward rate that changes when another yield is chosen. */
const RewardRate = ({
  rates,
  initial,
}: {
  readonly rates: ReadonlyArray<number>;
  readonly initial?: number;
}) => {
  const [index, setIndex] = useState(0);
  return (
    <Stack gap={12} align="start">
      <Text variant="display" as="p">
        <AnimatedNumber
          value={rates[index] ?? 0}
          format={formatPercent}
          {...(initial === undefined ? {} : { initial })}
        />
      </Text>
      <Button
        variant="secondary"
        onClick={() => setIndex((current) => (current + 1) % rates.length)}
      >
        Next yield
      </Button>
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

/** With `initial`, it counts up from that value on mount. */
export const CountUp: Story = {
  args: { initial: 0 },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(figure(canvasElement)).toHaveTextContent("4.21%")
    );
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

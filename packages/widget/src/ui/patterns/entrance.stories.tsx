import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";

import { Card } from "../components/card";
import { Text } from "../primitives/text";
import { Entrance } from "./entrance";

const meta = {
  title: "Patterns/Entrance",
  component: Entrance,
  args: {
    stage: "later",
    onEntered: fn(),
    children: (
      <Card>
        <Text variant="heading" as="h2">
          Earn
        </Text>
      </Card>
    ),
  },
} satisfies Meta<typeof Entrance>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Waits until the content holding `heading` is in place. */
const settled = (heading: HTMLElement) =>
  waitFor(() => {
    const content = heading.closest<HTMLElement>("[style*='opacity']");
    return expect(content?.style.opacity).toBe("1");
  });

/** A later mount drops in briefly and reports when it is in place. */
export const Later: Story = {
  play: async ({ canvasElement, args }) => {
    const heading = within(canvasElement).getByRole("heading", {
      name: "Earn",
    });
    await settled(heading);
    await waitFor(() => expect(args.onEntered).toHaveBeenCalledOnce());
  },
};

/** The first mount waits for the frame to open, then drops in slowly. */
export const First: Story = {
  args: { stage: "first" },
  play: async ({ canvasElement, args }) => {
    const heading = within(canvasElement).getByRole("heading", {
      name: "Earn",
    });
    await waitFor(() => expect(args.onEntered).toHaveBeenCalledOnce(), {
      timeout: 3000,
    });
    await settled(heading);
  },
};

/** Still content shows in place at once and still reports it. */
export const Still: Story = {
  args: { stage: "still" },
  play: async ({ canvasElement, args }) => {
    await expect(
      within(canvasElement).getByRole("heading", { name: "Earn" })
    ).toBeVisible();
    await waitFor(() => expect(args.onEntered).toHaveBeenCalledOnce());
  },
};

export const StillDark: Story = {
  args: { stage: "still" },
  globals: { colorScheme: "dark" },
};

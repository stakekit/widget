import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Icon } from "./icon";
import { Stack } from "./stack";
import { VisuallyHidden } from "./visually-hidden";

const meta = {
  title: "Primitives/VisuallyHidden",
  component: VisuallyHidden,
} satisfies Meta<typeof VisuallyHidden>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Screen readers read the text; the page paints only the icon. */
export const BesideAnIcon: Story = {
  render: () => (
    <Stack direction="row" role="group" aria-label="Rewards">
      <Icon name="GiftIcon" />
      <VisuallyHidden>Rewards available</VisuallyHidden>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const text = within(canvasElement).getByText("Rewards available");
    await expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  },
};

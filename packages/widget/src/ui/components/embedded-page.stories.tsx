import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Box } from "../primitives/box";
import { EmbeddedPage } from "./embedded-page";

const meta = {
  title: "Components/EmbeddedPage",
  component: EmbeddedPage,
  args: { src: "about:blank", title: "Verification", testId: "frame" },
  render: (args) => (
    <Box width="full" maxWidth="sm">
      <EmbeddedPage {...args} />
    </Box>
  ),
} satisfies Meta<typeof EmbeddedPage>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A titled frame that fills its parent's width. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const frame = within(canvasElement).getByTitle("Verification");
    await expect(frame).toHaveAttribute("data-testid", "frame");
    await expect(frame).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin"
    );
  },
};

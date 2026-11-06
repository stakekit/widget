import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Logo } from "./logo";

const meta = {
  title: "Artwork/Logo",
  component: Logo,
} satisfies Meta<typeof Logo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={12}>
      <Logo size="sm" />
      <Logo size="md" />
      <Logo size="lg" />
    </Stack>
  ),
};

export const SizesDark: Story = { ...Sizes, globals: { colorScheme: "dark" } };

/** With a label the artwork is an image with that name; without, it is hidden. */
export const Labelled: Story = {
  args: { label: "StakeKit" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "StakeKit" })
    ).toBeVisible();
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { MorphoMark } from "./morpho-mark";

const meta = {
  title: "Artwork/MorphoMark",
  component: MorphoMark,
} satisfies Meta<typeof MorphoMark>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={12}>
      <MorphoMark size="sm" />
      <MorphoMark size="md" />
      <MorphoMark size="lg" />
    </Stack>
  ),
};

export const SizesDark: Story = { ...Sizes, globals: { colorScheme: "dark" } };

/** With a label the artwork is an image with that name; without, it is hidden. */
export const Labelled: Story = {
  args: { label: "Morpho" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("img", { name: "Morpho" })
    ).toBeVisible();
  },
};

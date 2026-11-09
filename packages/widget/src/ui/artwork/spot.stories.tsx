import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Spot } from "./spot";

const meta = {
  title: "Artwork/Spot",
  component: Spot,
  args: { icon: "LayersIcon" },
} satisfies Meta<typeof Spot>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Every tone at both sizes; decorative, so hidden from assistive technology. */
export const Tones: Story = {
  render: (args) => (
    <Stack gap={16}>
      {(["md", "lg"] as const).map((size) => (
        <Stack key={size} direction="row" gap={16} align="center">
          <Spot {...args} size={size} tone="neutral" />
          <Spot {...args} size={size} tone="accent" icon="GlobeIcon" />
          <Spot {...args} size={size} tone="warning" icon="WrenchIcon" />
          <Spot {...args} size={size} tone="danger" icon="WarningIcon" />
        </Stack>
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("svg")).toHaveLength(8);
    await expect(canvasElement.querySelector('[role="img"]')).toBeNull();
  },
};

export const Dark: Story = { ...Tones, globals: { colorScheme: "dark" } };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { Divider } from "./divider";

const meta = {
  title: "Components/Divider",
  component: Divider,
} satisfies Meta<typeof Divider>;
export default meta;

type Story = StoryObj<typeof meta>;

export const HorizontalDivider: Story = {
  render: () => (
    <Stack gap={12}>
      <Text>Above</Text>
      <Divider />
      <Text>Below</Text>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("separator")).toBeVisible();
  },
};

export const VerticalDivider: Story = {
  render: () => (
    <Stack direction="row" gap={12}>
      <Text>Start</Text>
      <Divider orientation="vertical" />
      <Text>End</Text>
    </Stack>
  ),
};

export const DividerDark: Story = {
  ...HorizontalDivider,
  globals: { colorScheme: "dark" },
};

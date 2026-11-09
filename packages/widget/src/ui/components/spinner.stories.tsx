import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { Spinner } from "./spinner";

const meta = {
  title: "Components/Spinner",
  component: Spinner,
} satisfies Meta<typeof Spinner>;
export default meta;

type Story = StoryObj<typeof meta>;

export const SpinnerSizes: Story = {
  render: () => (
    <Stack direction="row" align="center" gap={12}>
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <Spinner tone="accent" />
    </Stack>
  ),
};

/** With a label the spinner is a status that names the work. */
export const SpinnerWithLabel: Story = {
  render: () => <Spinner label="Loading positions" />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("status", { name: "Loading positions" })
    ).toBeVisible();
  },
};

export const SpinnerDark: Story = {
  ...SpinnerSizes,
  globals: { colorScheme: "dark" },
};

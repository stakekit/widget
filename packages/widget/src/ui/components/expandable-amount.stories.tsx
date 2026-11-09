import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Text } from "../primitives/text";
import { ExpandableAmount } from "./expandable-amount";

const meta = {
  title: "Components/ExpandableAmount",
  component: ExpandableAmount,
  args: { short: "1.23K", full: "1,234.567891" },
  render: (args) => (
    <Text variant="metric">
      <ExpandableAmount {...args} />
    </Text>
  ),
} satisfies Meta<typeof ExpandableAmount>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Short: Story = {};

export const Expanded: Story = { args: { defaultExpanded: true } };

export const ShortDark: Story = { globals: { colorScheme: "dark" } };

/** A click expands the amount, and Enter shortens it again. */
export const Toggle: Story = {
  play: async ({ canvasElement }) => {
    const amount = within(canvasElement).getByRole("button", { name: "1.23K" });

    await userEvent.click(amount);
    await expect(amount).toHaveTextContent("1,234.567891");

    await userEvent.keyboard("{Enter}");
    await expect(amount).toHaveTextContent("1.23K");
  },
};

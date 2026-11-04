import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Text } from "../primitives/text";
import { ExternalLink } from "./external-link";

const meta = {
  title: "Components/ExternalLink",
  component: ExternalLink,
  args: {
    href: "https://etherscan.io/tx/0x12",
    newTabLabel: "opens in a new tab",
    children: "View on explorer",
  },
  render: (args) => (
    <Text as="p">
      {"Transaction sent. "}
      <ExternalLink {...args} />
    </Text>
  ),
} satisfies Meta<typeof ExternalLink>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Tab reaches the link; its name says it opens a new tab, which it does
 * without access to this page.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: "View on explorer opens in a new tab",
    });

    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};

export const Dark: Story = { globals: { colorScheme: "dark" } };

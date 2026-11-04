import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ButtonAnchor } from "./button-anchor";

const meta = {
  title: "Components/ButtonAnchor",
  component: ButtonAnchor,
  args: { href: "#positions", children: "View positions" },
} satisfies Meta<typeof ButtonAnchor>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};

export const PrimaryWithIcon: Story = {
  args: { variant: "primary", iconEnd: "CaretDownIcon" },
};

export const PrimaryDark: Story = {
  args: { variant: "primary" },
  globals: { colorScheme: "dark" },
};

/**
 * It is a link: Tab reaches it, and an external one opens a new tab safely
 * and says so in its name.
 */
export const Keyboard: Story = {
  args: {
    href: "https://example.com",
    external: true,
    newTabLabel: "opens in a new tab",
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link", {
      name: "View positions opens in a new tab",
    });

    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  },
};

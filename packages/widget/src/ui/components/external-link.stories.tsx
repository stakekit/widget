import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Text } from "../primitives/text";
import { Button } from "./button";
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

/** `onClick` runs as the link opens, such as to record the visit. */
export const WithClickHandler: Story = {
  args: { onClick: fn() },
  beforeEach: () => {
    // Keep the test page from opening the explorer in a new tab.
    const stay = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("click", stay, { capture: true });
    return () => window.removeEventListener("click", stay, { capture: true });
  },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("link", {
        name: "View on explorer opens in a new tab",
      })
    );
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/**
 * With `button`, the link has a button's look and matches a button's height
 * beside it; it still opens a new tab and says so.
 */
export const ButtonLook: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <ExternalLink {...args} button={{ variant: "secondary" }} />
      <Button variant="dangerOutline">Disconnect</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link", {
      name: "View on explorer opens in a new tab",
    });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const button = canvas.getByRole("button", { name: "Disconnect" });
    await expect(link.getBoundingClientRect().height).toBe(
      button.getBoundingClientRect().height
    );

    await userEvent.tab();
    await expect(link).toHaveFocus();
  },
};

export const ButtonLookDark: Story = {
  ...ButtonLook,
  globals: { colorScheme: "dark" },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { CopyButton } from "./copy-button";

const address = "0x1234567890abcdef1234567890abcdef12345678";
const writeText = fn(async (_text: string) => {});

const meta = {
  title: "Components/CopyButton",
  component: CopyButton,
  args: { value: address, label: "Copy address", copiedLabel: "Copied" },
  // The story replaces the clipboard, so nothing leaves the page.
  beforeEach: () => {
    const clipboard = navigator.clipboard;
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    return () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: clipboard,
      });
    };
  },
} satisfies Meta<typeof CopyButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: "sm" } };

export const Dark: Story = { globals: { colorScheme: "dark" } };

/** Enter copies the full value and announces the outcome. */
export const KeyboardCopy: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Copy address" });

    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(writeText).toHaveBeenCalledWith(address);
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent("Copied")
    );
  },
};

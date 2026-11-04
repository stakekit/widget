import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { IconButton } from "./icon-button";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  args: { icon: "XIcon", label: "Close", onClick: fn() },
} satisfies Meta<typeof IconButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Ghost: Story = {};

/** Every variant at every size. */
export const VariantsAndSizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 12 }}>
      {(["ghost", "secondary"] as const).map((variant) => (
        <div key={variant} style={{ display: "flex", gap: 12 }}>
          {(["xs", "sm", "md"] as const).map((size) => (
            <IconButton
              key={size}
              {...args}
              variant={variant}
              size={size}
              label={`Close ${variant} ${size}`}
            />
          ))}
        </div>
      ))}
    </div>
  ),
};

export const VariantsAndSizesDark: Story = {
  ...VariantsAndSizes,
  globals: { colorScheme: "dark" },
};

/** Its label is its accessible name; Enter and Space activate it. */
export const KeyboardActivation: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Close" });

    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

/** A disabled icon button is skipped by Tab and ignores clicks. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Close" });

    await expect(button).toBeDisabled();
    await userEvent.tab();
    await expect(button).not.toHaveFocus();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

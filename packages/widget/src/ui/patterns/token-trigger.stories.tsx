import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { brokenImage, networkLogo, tokenLogo } from "../storybook/images";
import { TokenTrigger } from "./token-trigger";

const meta = {
  title: "Patterns/TokenTrigger",
  component: TokenTrigger,
  args: {
    token: { name: "ETH", src: tokenLogo, networkSrc: networkLogo },
    onClick: fn(),
  },
} satisfies Meta<typeof TokenTrigger>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A button named by the token's symbol; the logo beside it is decorative. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "ETH" });
    await userEvent.click(trigger);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/** The elevated surface style keeps the pill raised. */
export const Elevated: Story = {
  ...Default,
  globals: { surfaceStyle: "elevated" },
};

/** Keyboard users reach it with Tab and open it with Enter. */
export const Keyboard: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.tab();
    await expect(
      within(canvasElement).getByRole("button", { name: "ETH" })
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/** With no other token to choose, it shows the token without a button. */
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvas.getByText("ETH")).toBeVisible();
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "ETH" });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

/** Without a logo, the symbol's initial stands in; long symbols truncate. */
export const FallbackAndTruncation: Story = {
  render: (args) => (
    <Stack gap={8} align="start">
      <TokenTrigger {...args} token={{ name: "USDC", src: brokenImage }} />
      <div style={{ width: 120 }}>
        <TokenTrigger
          {...args}
          token={{ name: "LONGSYMBOLTOKEN", src: tokenLogo }}
        />
      </div>
    </Stack>
  ),
};

/**
 * An account's trigger: its generated avatar beside the address, named by the
 * address, and located by hosts through `hostHook`.
 */
export const Account: Story = {
  args: {
    token: { name: "0x12…cdef" },
    account: "0x1234567890abcdef1234567890abcdef12345678",
    hostHook: "account-modal-container",
  },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "0x12…cdef",
    });
    await expect(trigger).toHaveAttribute("data-rk", "account-modal-container");
    await userEvent.click(trigger);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

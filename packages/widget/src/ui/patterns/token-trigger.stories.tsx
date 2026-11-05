import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Tabs } from "../components/tabs";
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

/**
 * A touch-sized pill: about 44px tall, the logo large enough to recognise and
 * the symbol at heading size, all on one line.
 */
export const Size: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "ETH" });
    const box = trigger.getBoundingClientRect();
    await expect(box.height).toBeGreaterThanOrEqual(42);
    await expect(box.height).toBeLessThanOrEqual(46);

    const logo = trigger.firstElementChild?.getBoundingClientRect();
    await expect(logo?.height).toBe(28);
    await expect(logo?.width).toBe(28);
    await expect(logo?.top).toBeGreaterThan(box.top);
    await expect(logo?.bottom).toBeLessThan(box.bottom);

    const symbol = canvas.getByText("ETH");
    await expect(getComputedStyle(symbol).fontSize).toBe("16px");
    await expect(Number(getComputedStyle(symbol).fontWeight)).toBe(600);
    const symbolBox = symbol.getBoundingClientRect();
    await expect(symbolBox.height).toBeLessThan(box.height / 1.5);
  },
};

/**
 * A wallet header's pills: `sm` as tall as a small control, `tabs` as tall
 * as the pill tabs list beside it, both with a small logo and body text.
 */
export const HeaderSizes: Story = {
  globals: { tabsIndicator: "pill" },
  render: (args) => (
    <Stack gap={16} align="start">
      <TokenTrigger {...args} size="sm" testId="sm" />
      <Stack direction="row" align="center" gap={8}>
        <Tabs
          label="Sections"
          tabs={[
            { value: "earn", label: "Earn" },
            { value: "manage", label: "Manage" },
          ]}
          value="earn"
          onValueChange={fn()}
        />
        <TokenTrigger {...args} size="tabs" testId="tabs" />
      </Stack>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("sm").getBoundingClientRect().height).toBe(
      32
    );
    await expect(
      canvas.getByTestId("tabs").getBoundingClientRect().height
    ).toBe(
      canvas.getByRole("tablist", { name: "Sections" }).getBoundingClientRect()
        .height
    );
    for (const trigger of [
      canvas.getByTestId("sm"),
      canvas.getByTestId("tabs"),
    ]) {
      const logo = trigger.firstElementChild?.getBoundingClientRect();
      await expect(logo?.height).toBe(24);
      await expect(
        getComputedStyle(within(trigger).getByText("ETH")).fontSize
      ).toBe("14px");
    }
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

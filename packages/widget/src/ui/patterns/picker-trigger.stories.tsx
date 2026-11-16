import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Tabs } from "../components/tabs";
import { Stack } from "../primitives/stack";
import { brokenImage, networkLogo, tokenLogo } from "../storybook/images";
import { PickerTrigger } from "./picker-trigger";

const meta = {
  title: "Patterns/PickerTrigger",
  component: PickerTrigger,
  args: {
    label: "ETH",
    logo: { src: tokenLogo, networkSrc: networkLogo },
    onClick: fn(),
  },
} satisfies Meta<typeof PickerTrigger>;
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
 * A preset with tight corners rounds the pill as its controls: Porto's 4px,
 * Utila's 8px; the default stays fully rounded.
 */
export const PresetCorners: Story = {
  globals: { appearancePreset: "porto" },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "ETH" });
    await expect(getComputedStyle(trigger).borderRadius).toBe("4px");
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

/** The first fill under the element: the frame it sits on. */
const frameFill = (element: Element) => {
  for (
    let ancestor = element.parentElement;
    ancestor !== null;
    ancestor = ancestor.parentElement
  ) {
    const fill = getComputedStyle(ancestor).backgroundColor;
    // Skip fully transparent fills (alpha 0).
    if (!fill.endsWith(", 0)") && fill !== "transparent") return fill;
  }
  return undefined;
};

/**
 * A wallet header's pills: `sm` as tall as a small control, `tabs` as tall
 * as the pill tabs list beside it, both with a small logo and body text. They
 * are filled like the tabs list, so they stand off the frame unraised.
 */
export const HeaderSizes: Story = {
  globals: { tabsIndicator: "pill" },
  render: (args) => (
    <Stack gap={16} align="start">
      <PickerTrigger {...args} size="sm" testId="sm" />
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
        <PickerTrigger {...args} size="tabs" testId="tabs" />
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
      const fill = getComputedStyle(trigger).backgroundColor;
      await expect(fill).not.toBe(frameFill(trigger));
      await expect(fill).toBe(
        getComputedStyle(canvas.getByRole("tablist", { name: "Sections" }))
          .backgroundColor
      );
    }
  },
};

export const HeaderSizesDark: Story = {
  ...HeaderSizes,
  globals: { ...HeaderSizes.globals, colorScheme: "dark" },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

/**
 * Under the elevated surface style the card it sits in is raised, so the pill
 * fills with `surface`, edges in `border` and casts no shadow of its own.
 */
export const Elevated: Story = {
  ...Default,
  globals: { surfaceStyle: "elevated" },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "ETH" });
    await expect(getComputedStyle(trigger).boxShadow).toBe("none");
  },
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
      <PickerTrigger {...args} label="USDC" logo={{ src: brokenImage }} />
      <div style={{ width: 120 }}>
        <PickerTrigger
          {...args}
          label="LONGSYMBOLTOKEN"
          logo={{ src: tokenLogo }}
        />
      </div>
    </Stack>
  ),
};

/**
 * With no logo it names an action, such as "Change" beside a chosen
 * validator: the same raised pill and caret as beside an amount, the label
 * inset from the start edge.
 */
export const LabelOnly: Story = {
  render: (args) => {
    const { logo: _logo, ...labelOnly } = args;
    return (
      <Stack gap={8} align="start">
        <PickerTrigger {...labelOnly} label="Change" />
        <PickerTrigger {...args} />
      </Stack>
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Change" });
    const box = trigger.getBoundingClientRect();
    const label = canvas.getByText("Change").getBoundingClientRect();
    // The label and the caret, no avatar.
    await expect(trigger.childElementCount).toBe(2);
    await expect(label.left - box.left).toBeGreaterThanOrEqual(12);
    const token = canvas.getByRole("button", { name: "ETH" });
    await expect(box.height).toBe(token.getBoundingClientRect().height);
    await expect(getComputedStyle(trigger).boxShadow).toBe(
      getComputedStyle(token).boxShadow
    );
    await userEvent.click(trigger);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/**
 * An account's trigger: its generated avatar beside the address, named by the
 * address, and located by hosts through `hostHook`.
 */
export const Account: Story = {
  args: {
    label: "0x12…cdef",
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

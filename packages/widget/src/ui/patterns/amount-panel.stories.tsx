import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentProps, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { networkLogo, tokenLogo } from "../storybook/images";
import { AmountPanel } from "./amount-panel";
import { TokenTrigger } from "./token-trigger";

type PanelProps = ComponentProps<typeof AmountPanel>;

/** Holds the amount, as the Feature's state would. */
const StatefulPanel = (props: PanelProps) => {
  const [value, setValue] = useState(props.value);
  return (
    <div style={{ width: 360 }}>
      <AmountPanel
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          props.onValueChange(next);
        }}
        {...(props.max === undefined
          ? {}
          : {
              max: {
                ...props.max,
                onClick: () => {
                  setValue("12.5");
                  props.max?.onClick();
                },
              },
            })}
      />
    </div>
  );
};

/** The props every panel needs, without the optional foot. */
const minimalArgs = {
  label: "Stake",
  value: "",
  onValueChange: fn(),
  separators: { decimal: ".", group: "," },
  token: (
    <TokenTrigger
      token={{ name: "ETH", src: tokenLogo, networkSrc: networkLogo }}
    />
  ),
  fiatValue: "$0.00",
};

const meta = {
  title: "Patterns/AmountPanel",
  component: AmountPanel,
  args: {
    ...minimalArgs,
    balance: {
      short: "12.5 ETH available",
      full: "12.534217890123 ETH available",
    },
    limits: "Min 0.01 ETH",
    max: { label: "Max", onClick: fn() },
  },
  render: (args) => <StatefulPanel {...args} />,
} satisfies Meta<typeof AmountPanel>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The label names the amount, and the limits describe it. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const amount = within(canvasElement).getByRole("textbox", {
      name: "Stake",
    });
    await expect(amount).toHaveAccessibleDescription("Min 0.01 ETH");
    await userEvent.type(amount, "1.5");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("1.5");
  },
};

export const Dark: Story = {
  ...Default,
  globals: { colorScheme: "dark" },
};

export const Elevated: Story = {
  ...Default,
  globals: { surfaceStyle: "elevated" },
};

/** The "Max" chip fills in the most the user can use. */
export const MaxChip: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Max" }));
    await expect(args.max?.onClick).toHaveBeenCalledOnce();
    await expect(canvas.getByRole("textbox", { name: "Stake" })).toHaveValue(
      "12.5"
    );
  },
};

/**
 * An error replaces the limits, marks the amount invalid and describes it;
 * the balance it exceeds turns danger.
 */
export const Invalid: Story = {
  args: {
    value: "20",
    fiatValue: "$48,000.00",
    error: "Insufficient balance",
    balance: { short: "12.5 ETH available", tone: "danger" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const amount = canvas.getByRole("textbox", { name: "Stake" });
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(amount).toHaveAccessibleDescription("Insufficient balance");
    await expect(canvas.queryByText("Min 0.01 ETH")).toBeNull();
  },
};

export const InvalidDark: Story = {
  ...Invalid,
  globals: { colorScheme: "dark" },
};

/** Disabled, the amount and the chip do not take input. */
export const Disabled: Story = {
  args: { value: "1", disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "Stake" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Max" })).toBeDisabled();
  },
};

/** Without a balance or a "Max" chip, only the fiat value sits at the foot. */
export const Minimal: Story = {
  render: () => <StatefulPanel {...minimalArgs} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Max" })).toBeNull();
    await expect(canvas.getByText("$0.00")).toBeVisible();
  },
};

/** A tap on the balance shows it at full precision, and another shortens it. */
export const ExpandBalance: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "12.5 ETH available" })
    );
    const full = canvas.getByRole("button", {
      name: "12.534217890123 ETH available",
    });
    await expect(full).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("button", { name: "12.5 ETH available" })
    ).toBeVisible();
  },
};

/** A balance over the amount's reach reads in the danger tone. */
export const BalanceDanger: Story = {
  args: { balance: { short: "12.5 ETH available", tone: "danger" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toneOf = (text: string) =>
      getComputedStyle(canvas.getByText(text)).color;
    await expect(toneOf("12.5 ETH available")).not.toBe(toneOf("$0.00"));
  },
};

const reveal = fn();

/**
 * A confidential balance stays masked until revealed; with no known maximum,
 * the "Max" chip is left out.
 */
export const ConfidentialBalance: Story = {
  render: () => (
    <StatefulPanel
      {...minimalArgs}
      balance={{
        short: "•••• ETH",
        action: { label: "Reveal", onClick: reveal },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("•••• ETH")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Max" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Reveal" }));
    await expect(reveal).toHaveBeenCalledOnce();
  },
};

/** While the balance is revealed, its chip waits. */
export const RevealingBalance: Story = {
  render: () => (
    <StatefulPanel
      {...minimalArgs}
      balance={{
        short: "•••• ETH",
        action: { label: "Revealing", onClick: reveal, disabled: true },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: "Revealing" })
    ).toBeDisabled();
  },
};

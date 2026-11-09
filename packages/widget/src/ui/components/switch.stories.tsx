import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Switch } from "./switch";

const StatefulSwitch = ({
  initial,
  onCheckedChange,
  disabled = false,
  labelFirst = false,
  labelHidden = false,
}: {
  readonly initial: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly labelFirst?: boolean;
  readonly labelHidden?: boolean;
}) => {
  const [checked, setChecked] = useState(initial);
  return (
    <div style={{ width: 280 }}>
      <Switch
        checked={checked}
        onCheckedChange={(next) => {
          setChecked(next);
          onCheckedChange(next);
        }}
        label="Use as collateral"
        disabled={disabled}
        labelFirst={labelFirst}
        labelHidden={labelHidden}
      />
    </div>
  );
};

const meta = {
  title: "Components/Switch",
  component: StatefulSwitch,
  args: { initial: false, onCheckedChange: fn() },
} satisfies Meta<typeof StatefulSwitch>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { initial: true } };

export const OnDark: Story = {
  args: { initial: true },
  globals: { colorScheme: "dark" },
};

export const LabelFirst: Story = { args: { labelFirst: true } };

/** Tab reaches the switch; Space toggles it and the role's state follows. */
export const KeyboardToggle: Story = {
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole("switch", {
      name: "Use as collateral",
    });

    await userEvent.tab();
    await expect(control).toHaveFocus();
    await expect(control).not.toBeChecked();

    await userEvent.keyboard(" ");
    await expect(control).toBeChecked();
    await expect(args.onCheckedChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard(" ");
    await expect(control).not.toBeChecked();
  },
};

/** Clicking the label toggles the switch. */
export const LabelClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Use as collateral"));
    await expect(canvas.getByRole("switch")).toBeChecked();
  },
};

/** A disabled switch is announced as such and ignores input. */
export const Disabled: Story = {
  args: { initial: true, disabled: true },
  play: async ({ args, canvasElement }) => {
    const control = within(canvasElement).getByRole("switch");

    await expect(control).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(control, { pointerEventsCheck: 0 });
    await expect(control).toBeChecked();
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};

/**
 * A disabled switch keeps its on look, faded, so it reads as on but locked
 * rather than as another enabled switch.
 */
export const DisabledLook: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12, width: 280 }}>
      <Switch checked onCheckedChange={fn()} label="Enabled" />
      <Switch checked onCheckedChange={fn()} label="Disabled" disabled />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const enabled = getComputedStyle(
      canvas.getByRole("switch", { name: "Enabled" })
    );
    const disabled = getComputedStyle(
      canvas.getByRole("switch", { name: "Disabled" })
    );

    await expect(disabled.backgroundColor).toBe(enabled.backgroundColor);
    await expect(Number(disabled.opacity)).toBeLessThan(0.5);
    await expect(Number(enabled.opacity)).toBe(1);
  },
};

export const DisabledDark: Story = {
  ...DisabledLook,
  globals: { colorScheme: "dark" },
};

/** A hidden label still names the switch for assistive technology. */
export const LabelHidden: Story = {
  args: { labelHidden: true },
  play: async ({ canvasElement }) => {
    const control = within(canvasElement).getByRole("switch", {
      name: "Use as collateral",
    });
    await userEvent.click(control);
    await expect(control).toBeChecked();
  },
};

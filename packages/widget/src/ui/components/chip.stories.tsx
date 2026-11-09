import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { softControlSetOff } from "../storybook/painted-color";
import { Card } from "./card";
import { Chip } from "./chip";

const meta = {
  title: "Components/Chip",
  component: Chip,
  args: { children: "Max", onClick: fn() },
} satisfies Meta<typeof Chip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true } };

export const Disabled: Story = { args: { disabled: true } };

/**
 * As tall as a small control, its label centred, so it is an easy target
 * beside an amount. A coarse pointer reaches it from a little around it
 * too; a fine pointer's target is the drawn pill.
 */
export const Size: Story = {
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByRole("button", { name: "Max" });
    await expect(chip.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      32
    );
    await expect(getComputedStyle(chip, "::before").content).toBe("none");
  },
};

export const States: Story = {
  render: (args) => (
    <Stack direction="row" gap={8}>
      <Chip {...args}>25%</Chip>
      <Chip {...args} selected>
        50%
      </Chip>
      <Chip {...args} disabled>
        Max
      </Chip>
    </Stack>
  ),
};

export const StatesDark: Story = {
  ...States,
  globals: { colorScheme: "dark" },
};

/**
 * On a filled card, such as the amount panel's "Max", the chip's tint nearly
 * matches the card's surface, so a 1px accent edge, at least 1.5:1 on the
 * card (as the contrast test holds it), bounds it in either scheme.
 */
export const SetOffTheSurface: Story = {
  render: (args) => (
    <Card padding={16} testId="surface">
      <Chip {...args} />
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const setOff = softControlSetOff(
      canvas.getByRole("button", { name: "Max" }),
      getComputedStyle(canvas.getByTestId("surface")).backgroundColor
    );

    await expect(setOff.fillDiffers).toBe(true);
    await expect(setOff.edgeWidth).toBe("1px");
    await expect(setOff.edgeOpaque).toBe(true);
    await expect(setOff.edgeContrast).toBeGreaterThanOrEqual(1.5);
  },
};

export const SetOffTheSurfaceDark: Story = {
  ...SetOffTheSurface,
  globals: { colorScheme: "dark" },
};

/** Tab reaches the chip; Enter presses it. */
export const KeyboardActivation: Story = {
  play: async ({ args, canvasElement }) => {
    const chip = within(canvasElement).getByRole("button", { name: "Max" });
    await userEvent.tab();
    await expect(chip).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

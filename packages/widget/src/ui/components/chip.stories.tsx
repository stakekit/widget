import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Stack } from "../primitives/stack";
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

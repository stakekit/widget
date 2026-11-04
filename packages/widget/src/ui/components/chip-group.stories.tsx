import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChipGroup } from "./chip-group";
import type { ToggleOption } from "./segmented-control";

type Filter = "stake" | "unstake" | "claim" | "pending";

const filters: ReadonlyArray<ToggleOption<Filter>> = [
  { value: "stake", label: "Stake" },
  { value: "unstake", label: "Unstake" },
  { value: "claim", label: "Claim", disabled: true },
  { value: "pending", label: "Pending" },
];

const StatefulChipGroup = ({
  onValueChange,
  disabled = false,
}: {
  readonly onValueChange: (value: ReadonlyArray<Filter>) => void;
  readonly disabled?: boolean;
}) => {
  const [value, setValue] = useState<ReadonlyArray<Filter>>(["stake"]);
  return (
    <ChipGroup
      options={filters}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
      label="Activity filters"
      disabled={disabled}
    />
  );
};

const meta = {
  title: "Components/ChipGroup",
  component: StatefulChipGroup,
  args: { onValueChange: fn() },
} satisfies Meta<typeof StatefulChipGroup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/** A chip's count follows its label. */
export const WithCounts: Story = {
  render: ({ onValueChange }) => (
    <ChipGroup
      options={[
        { value: "stake", label: "Stake", count: "12" },
        { value: "unstake", label: "Unstake", count: "3" },
        { value: "pending", label: "Pending", count: "0" },
      ]}
      value={["stake"]}
      onValueChange={onValueChange}
      label="Activity filters"
    />
  ),
  play: async ({ canvasElement }) => {
    const stake = within(canvasElement).getByRole("button", { name: /Stake/ });
    await expect(stake).toHaveTextContent("Stake12");
    await expect(stake).toHaveAttribute("aria-pressed", "true");
  },
};

export const WithCountsDark: Story = {
  ...WithCounts,
  globals: { colorScheme: "dark" },
};

/**
 * Arrows move between chips, skipping a disabled one; Enter and Space toggle
 * the focused chip. An on chip is pressed, and several can be on.
 */
export const KeyboardSelection: Story = {
  play: async ({ args, canvasElement }) => {
    const group = within(canvasElement).getByRole("group", {
      name: "Activity filters",
    });
    const stake = within(group).getByRole("button", { name: "Stake" });
    const unstake = within(group).getByRole("button", { name: "Unstake" });
    const pending = within(group).getByRole("button", { name: "Pending" });

    await userEvent.tab();
    await expect(stake).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(unstake).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(unstake).toHaveAttribute("aria-pressed", "true");
    await expect(stake).toHaveAttribute("aria-pressed", "true");
    await expect(args.onValueChange).toHaveBeenLastCalledWith([
      "stake",
      "unstake",
    ]);

    await userEvent.keyboard("{ArrowRight}");
    await expect(pending).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft} ");
    await expect(stake).toHaveFocus();
    await expect(stake).toHaveAttribute("aria-pressed", "false");
    await expect(args.onValueChange).toHaveBeenLastCalledWith(["unstake"]);
  },
};

/** A disabled group toggles nothing. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const unstake = within(canvasElement).getByRole("button", {
      name: "Unstake",
    });

    await expect(unstake).toBeDisabled();
    await userEvent.click(unstake, { pointerEventsCheck: 0 });
    await expect(unstake).toHaveAttribute("aria-pressed", "false");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

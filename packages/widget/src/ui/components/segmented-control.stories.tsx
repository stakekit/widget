import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { SegmentedControl, type ToggleOption } from "./segmented-control";

type Period = "day" | "week" | "month" | "year";

const periods: ReadonlyArray<ToggleOption<Period>> = [
  { value: "day", label: "1D" },
  { value: "week", label: "1W" },
  { value: "month", label: "1M" },
  { value: "year", label: "1Y", disabled: true },
];

const StatefulSegmentedControl = ({
  onValueChange,
  disabled = false,
}: {
  readonly onValueChange: (value: Period) => void;
  readonly disabled?: boolean;
}) => {
  const [value, setValue] = useState<Period>("week");
  return (
    <SegmentedControl
      options={periods}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
      label="Chart period"
      disabled={disabled}
    />
  );
};

const meta = {
  title: "Components/SegmentedControl",
  component: StatefulSegmentedControl,
  args: { onValueChange: fn() },
} satisfies Meta<typeof StatefulSegmentedControl>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/**
 * Under the underline tabs indicator it marks its choice as the tabs do: an
 * accent line under the chosen label, on a bare track.
 */
export const Underline: Story = {
  globals: { tabsIndicator: "underline" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "Chart period" });
    const chosen = canvas.getByRole("button", { name: "1W" });
    // No track fill (alpha 0).
    await expect(getComputedStyle(group).backgroundColor).toMatch(/, 0\)$/);
    await expect(getComputedStyle(chosen).backgroundImage).toMatch(
      /linear-gradient/
    );
  },
};

/** Under the pill tabs indicator the chosen segment is raised in a track. */
export const Pill: Story = {
  globals: { tabsIndicator: "pill" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "Chart period" });
    const chosen = canvas.getByRole("button", { name: "1W" });
    await expect(getComputedStyle(group).backgroundColor).not.toMatch(/, 0\)$/);
    await expect(getComputedStyle(chosen).boxShadow).not.toMatch(/inset|none/);
  },
};

/**
 * A coarse pointer reaches each segment from a little around it too; a fine
 * pointer's target is the drawn segment.
 */
export const HitArea: Story = {
  play: async ({ canvasElement }) => {
    const segment = within(canvasElement).getByRole("button", { name: "1W" });
    await expect(getComputedStyle(segment).position).toBe("relative");
    await expect(getComputedStyle(segment, "::before").content).toBe("none");
  },
};

/**
 * The group is one tab stop. Arrows move between segments, skipping a
 * disabled one; Enter and Space choose. The chosen segment is pressed, and
 * choosing it again keeps it.
 */
export const KeyboardSelection: Story = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <button type="button">After</button>
      </>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("group", { name: "Chart period" });
    const day = within(group).getByRole("button", { name: "1D" });
    const week = within(group).getByRole("button", { name: "1W" });
    const month = within(group).getByRole("button", { name: "1M" });

    await expect(week).toHaveAttribute("aria-pressed", "true");

    await userEvent.tab();
    await expect(day).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(month).toHaveFocus();
    // Past the last enabled segment, focus wraps over the disabled one.
    await userEvent.keyboard("{ArrowRight}");
    await expect(day).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(month).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(month).toHaveAttribute("aria-pressed", "true");
    await expect(week).toHaveAttribute("aria-pressed", "false");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("month");

    await userEvent.keyboard(" ");
    await expect(month).toHaveAttribute("aria-pressed", "true");

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft} ");
    await expect(day).toHaveFocus();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(week).toHaveAttribute("aria-pressed", "false");

    // One tab stop: Tab leaves the group without visiting other segments.
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "After" })).toHaveFocus();
  },
};

/** A disabled control chooses nothing. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const day = within(canvasElement).getByRole("button", { name: "1D" });

    await expect(day).toBeDisabled();
    await userEvent.click(day, { pointerEventsCheck: 0 });
    await expect(day).toHaveAttribute("aria-pressed", "false");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Text } from "../primitives/text";
import { type TabOption, Tabs } from "./tabs";

type Section = "earn" | "positions" | "activity";

const sections: ReadonlyArray<TabOption<Section>> = [
  { value: "earn", label: "Earn" },
  { value: "positions", label: "Positions" },
  { value: "activity", label: "Activity", disabled: true },
];

const StatefulTabs = ({
  onValueChange,
}: {
  readonly onValueChange: (value: Section) => void;
}) => {
  const [value, setValue] = useState<Section>("earn");
  return (
    <Tabs
      tabs={sections}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
      label="Sections"
    >
      <Text as="p">{`The ${value} section`}</Text>
    </Tabs>
  );
};

const meta = {
  title: "Components/Tabs",
  component: StatefulTabs,
  args: { onValueChange: fn() },
} satisfies Meta<typeof StatefulTabs>;
export default meta;

type Story = StoryObj<typeof meta>;

const tabList = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole("tablist", { name: "Sections" });

/** The underline indicator: an accent bar under the selected tab, no pill. */
export const Underline: Story = {
  globals: { tabsIndicator: "underline" },
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const indicator = list.firstElementChild;

    await expect(getComputedStyle(list).paddingTop).toBe("0px");
    await expect(indicator).not.toBeNull();
    if (indicator) {
      await expect(getComputedStyle(indicator).boxShadow).toBe("none");
    }
  },
};

export const UnderlineDark: Story = {
  globals: { tabsIndicator: "underline", colorScheme: "dark" },
};

/** The pill indicator: a raised pill behind the selected tab, in a track. */
export const Pill: Story = {
  globals: { tabsIndicator: "pill" },
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const indicator = list.firstElementChild;

    await expect(getComputedStyle(list).paddingTop).toBe("4px");
    // A pill list draws no underline: its bottom border is fully transparent.
    await expect(getComputedStyle(list).borderBottomColor).toMatch(/, 0\)$/);
    await expect(indicator).not.toBeNull();
    if (indicator) {
      await expect(getComputedStyle(indicator).boxShadow).not.toBe("none");
    }
  },
};

export const PillDark: Story = {
  globals: { tabsIndicator: "pill", colorScheme: "dark" },
};

/**
 * The tab list is one tab stop. Tab reaches the selected tab; arrows move
 * between tabs and wrap at the ends; Enter selects. A disabled tab stays
 * reachable by arrow, so it is announced, but Enter does not select it.
 * Selection is the tab's `aria-selected`.
 */
export const KeyboardSelection: Story = {
  decorators: [
    (Story) => (
      <>
        <button type="button">Before</button>
        <Story />
      </>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const before = canvas.getByRole("button", { name: "Before" });
    const earn = canvas.getByRole("tab", { name: "Earn" });
    const positions = canvas.getByRole("tab", { name: "Positions" });
    const activity = canvas.getByRole("tab", { name: "Activity" });

    await expect(earn).toHaveAttribute("aria-selected", "true");
    await userEvent.tab();
    await expect(before).toHaveFocus();
    await userEvent.tab();
    await expect(earn).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    await expect(positions).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(activity).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(activity).toHaveAttribute("aria-selected", "false");
    await expect(earn).toHaveAttribute("aria-selected", "true");
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard("{ArrowRight}");
    await expect(earn).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(positions).toHaveFocus();

    // One tab stop: leaving backwards skips the other tabs, and coming back
    // returns to the tab last focused.
    await userEvent.tab({ shift: true });
    await expect(before).toHaveFocus();
    await userEvent.tab();
    await expect(positions).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(positions).toHaveAttribute("aria-selected", "true");
    await expect(earn).toHaveAttribute("aria-selected", "false");
    await expect(args.onValueChange).toHaveBeenCalledWith("positions");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "The positions section"
    );

    await userEvent.keyboard("{ArrowLeft}");
    await expect(earn).toHaveFocus();
  },
};

/** A disabled tab cannot be selected. */
export const DisabledTab: Story = {
  play: async ({ args, canvasElement }) => {
    const activity = within(canvasElement).getByRole("tab", {
      name: "Activity",
    });

    await expect(activity).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(activity, { pointerEventsCheck: 0 });
    await expect(activity).toHaveAttribute("aria-selected", "false");
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

const grouped: ReadonlyArray<TabOption<Section>> = [
  { value: "earn", label: "Earn" },
  { value: "positions", label: "Positions", count: 2, separated: true },
  { value: "activity", label: "Activity", count: 0 },
];

/**
 * A tab can carry a count that needs attention, which is part of its name, and
 * start a new group behind a divider the tab list skips.
 */
export const CountAndGroups: Story = {
  render: (args) => (
    <Tabs
      tabs={grouped}
      value="earn"
      onValueChange={args.onValueChange}
      label="Sections"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = tabList(canvasElement);

    await expect(
      canvas.getByRole("tab", { name: "Positions 2" })
    ).toBeVisible();
    // Zero shows no count.
    await expect(canvas.getByRole("tab", { name: "Activity" })).toBeVisible();
    await expect(within(list).getAllByRole("tab")).toHaveLength(3);
    await expect(list.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  },
};

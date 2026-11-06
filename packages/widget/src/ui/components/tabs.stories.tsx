import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Text } from "../primitives/text";
import { outlineUnclipped } from "../storybook/geometry";
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

/**
 * The underline indicator: an accent bar under the selected tab, no pill. It
 * covers the list's rule, bottom edge on its bottom edge, and the rule runs as
 * wide as the tabs, not the bar.
 */
export const Underline: Story = {
  globals: { tabsIndicator: "underline" },
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const indicator = list.firstElementChild;
    const tabs = within(list).getAllByRole("tab");
    const first = tabs.at(0);
    const last = tabs.at(-1);

    await expect(getComputedStyle(list).paddingTop).toBe("0px");
    await expect(indicator).not.toBeNull();
    await expect(first).toBeDefined();
    await expect(last).toBeDefined();
    if (indicator && first && last) {
      await expect(getComputedStyle(indicator).boxShadow).toBe("none");
      const listBox = list.getBoundingClientRect();
      const indicatorBox = indicator.getBoundingClientRect();
      const rule = Number.parseFloat(getComputedStyle(list).borderBottomWidth);
      await expect(rule).toBeGreaterThan(0);
      await expect(indicatorBox.bottom).toBeCloseTo(listBox.bottom, 1);
      await expect(indicatorBox.height).toBeGreaterThanOrEqual(rule);
      await expect(listBox.left).toBeCloseTo(
        first.getBoundingClientRect().left,
        1
      );
      await expect(listBox.right).toBeCloseTo(
        last.getBoundingClientRect().right,
        1
      );
    }
  },
};

export const UnderlineDark: Story = {
  globals: { tabsIndicator: "underline", colorScheme: "dark" },
};

const WithTrailing = () => {
  const [value, setValue] = useState<Section>("earn");
  return (
    <div data-testid="frame">
      <Tabs
        tabs={sections}
        value={value}
        onValueChange={setValue}
        label="Sections"
        trailing={<Text as="span">Controls</Text>}
      />
    </div>
  );
};

/**
 * Under the `outlined` surface style with an underline, the rule runs under
 * the whole row, controls included, and the selected tab's underline sits on
 * it; the list draws no rule of its own.
 */
export const UnderlineFullRowRule: Story = {
  globals: { tabsIndicator: "underline", surfaceStyle: "outlined" },
  render: () => <WithTrailing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = tabList(canvasElement);
    const bar = list.parentElement;
    const indicator = list.firstElementChild;
    if (!(bar instanceof HTMLElement) || !(indicator instanceof HTMLElement)) {
      throw new Error("Expected the tabs' row and indicator");
    }

    await expect(getComputedStyle(list).borderBottomWidth).toBe("0px");
    await expect(getComputedStyle(bar).borderBottomWidth).toBe("1px");
    // The row's rule spans the row, beyond the last tab, to the controls.
    const controls = canvas.getByText("Controls").getBoundingClientRect();
    const row = bar.getBoundingClientRect();
    await expect(row.right).toBeGreaterThanOrEqual(controls.right);
    await expect(row.width).toBeGreaterThan(list.getBoundingClientRect().width);
    // The underline's bottom edge meets the row's rule's bottom edge.
    await expect(indicator.getBoundingClientRect().bottom).toBeCloseTo(
      row.bottom,
      0
    );
  },
};

/** Elsewhere, controls beside the tabs leave the rule as wide as the tabs. */
export const UnderlineTabWidthRuleWithTrailing: Story = {
  globals: { tabsIndicator: "underline" },
  render: () => <WithTrailing />,
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const bar = list.parentElement;
    if (!(bar instanceof HTMLElement)) throw new Error("Expected the row");
    await expect(getComputedStyle(list).borderBottomWidth).toBe("1px");
    await expect(getComputedStyle(bar).borderBottomWidth).toBe("0px");
  },
};

/**
 * The tint indicator: the selected tab filled with `surface`, no track, no
 * shadow; beside controls, the row's rule runs under the whole row.
 */
export const Tint: Story = {
  globals: { tabsIndicator: "tint" },
  render: () => <WithTrailing />,
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const bar = list.parentElement;
    const indicator = list.firstElementChild;
    const selected = within(list).getByRole("tab", { selected: true });
    if (!(bar instanceof HTMLElement) || !(indicator instanceof HTMLElement)) {
      throw new Error("Expected the tabs' row and indicator");
    }

    const listStyle = getComputedStyle(list);
    await expect(listStyle.backgroundColor).toMatch(/, 0\)$|^transparent$/);
    await expect(listStyle.borderBottomWidth).toBe("0px");
    await expect(getComputedStyle(bar).borderBottomWidth).toBe("1px");
    const fill = getComputedStyle(indicator);
    await expect(fill.backgroundColor).not.toMatch(/, 0\)$/);
    await expect(fill.boxShadow).toBe("none");
    // The fill sits behind the selected tab, top to bottom.
    const tabBox = selected.getBoundingClientRect();
    const fillBox = indicator.getBoundingClientRect();
    await expect(fillBox.top).toBeCloseTo(tabBox.top, 0);
    await expect(fillBox.height).toBeCloseTo(tabBox.height, 0);
  },
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

/**
 * In a narrow bar that scrolls its tabs across, each tab draws its focus ring
 * inside its edge, where the bar would cut off one drawn outside, at either
 * end of the bar.
 */
export const RingInsideScrollingBar: Story = {
  render: (args) => (
    <div style={{ width: 140, overflowX: "auto" }}>
      <Tabs
        tabs={grouped}
        value="earn"
        onValueChange={args.onValueChange}
        label="Sections"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const earn = canvas.getByRole("tab", { name: "Earn" });
    const activity = canvas.getByRole("tab", { name: "Activity" });

    await userEvent.tab();
    await expect(earn).toHaveFocus();
    await expect(outlineUnclipped(earn)).toBe(true);

    await userEvent.keyboard("{ArrowLeft}");
    await expect(activity).toHaveFocus();
    await expect(outlineUnclipped(activity)).toBe(true);
  },
};

export const RingInsideScrollingBarPill: Story = {
  ...RingInsideScrollingBar,
  globals: { tabsIndicator: "pill" },
};

export const RingInsideScrollingBarDark: Story = {
  ...RingInsideScrollingBar,
  globals: { colorScheme: "dark" },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { Text } from "../primitives/text";
import { ContainerFrame } from "../storybook/container-frame";
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

/** The box around the tab list that draws an underline's rule. */
const railOf = (list: HTMLElement) => {
  const rail = list.parentElement;
  if (!(rail instanceof HTMLElement)) throw new Error("Expected the rail");
  return rail;
};

/** The tabs' row with controls at its end. */
const barOf = (list: HTMLElement) => {
  const bar = railOf(list).parentElement;
  if (!(bar instanceof HTMLElement)) throw new Error("Expected the row");
  return bar;
};

/**
 * The underline indicator: an accent bar under the selected tab, no pill. It
 * covers the rule, bottom edge on its bottom edge, and the rule runs the
 * full width of the row, past the last tab.
 */
export const Underline: Story = {
  globals: { tabsIndicator: "underline" },
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const rail = railOf(list);
    const indicator = list.firstElementChild;
    const last = within(list).getAllByRole("tab").at(-1);

    await expect(getComputedStyle(list).paddingTop).toBe("0px");
    await expect(indicator).not.toBeNull();
    await expect(last).toBeDefined();
    if (indicator && last) {
      await expect(getComputedStyle(indicator).boxShadow).toBe("none");
      await expect(getComputedStyle(rail).backgroundImage).toMatch(
        /linear-gradient/
      );
      const railBox = rail.getBoundingClientRect();
      await expect(indicator.getBoundingClientRect().bottom).toBeCloseTo(
        railBox.bottom,
        1
      );
      await expect(railBox.width).toBeGreaterThan(
        last.getBoundingClientRect().right - railBox.left
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
 * it; the tabs draw no rule of their own.
 */
export const UnderlineFullRowRule: Story = {
  globals: { tabsIndicator: "underline", surfaceStyle: "outlined" },
  render: () => <WithTrailing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = tabList(canvasElement);
    const bar = barOf(list);
    const indicator = list.firstElementChild;
    if (!(indicator instanceof HTMLElement)) {
      throw new Error("Expected the indicator");
    }

    await expect(getComputedStyle(railOf(list)).backgroundImage).toBe("none");
    await expect(getComputedStyle(bar).backgroundImage).toMatch(
      /linear-gradient/
    );
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

/** Elsewhere, beside controls, the rule runs from the first tab up to them. */
export const UnderlineRuleToControls: Story = {
  globals: { tabsIndicator: "underline" },
  render: () => <WithTrailing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = tabList(canvasElement);
    const rail = railOf(list).getBoundingClientRect();
    const controls = canvas.getByText("Controls").getBoundingClientRect();
    await expect(getComputedStyle(barOf(list)).backgroundImage).toBe("none");
    await expect(rail.width).toBeGreaterThan(
      list.getBoundingClientRect().width
    );
    // Up to the controls, past the gap between them.
    await expect(controls.left - rail.right).toBeLessThanOrEqual(16.5);
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
    const bar = barOf(list);
    const indicator = list.firstElementChild;
    const selected = within(list).getByRole("tab", { selected: true });
    if (!(indicator instanceof HTMLElement)) {
      throw new Error("Expected the indicator");
    }

    const listStyle = getComputedStyle(list);
    await expect(listStyle.backgroundColor).toMatch(/, 0\)$|^transparent$/);
    await expect(getComputedStyle(railOf(list)).backgroundImage).toBe("none");
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

/**
 * The pill indicator: a raised pill behind the selected tab, in a track as
 * tall as a wallet header's `tabs` pill.
 */
export const Pill: Story = {
  globals: { tabsIndicator: "pill" },
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const indicator = list.firstElementChild;

    await expect(getComputedStyle(list).paddingTop).toBe("4px");
    await expect(list.getBoundingClientRect().height).toBe(40);
    // A pill list draws no underline.
    await expect(getComputedStyle(railOf(list)).backgroundImage).toBe("none");
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
 * With a `countLabel`, the count reads as what it means: the tab shows the
 * number and is named by the label.
 */
export const CountLabel: Story = {
  render: (args) => (
    <Tabs
      tabs={[
        { value: "earn", label: "Earn" },
        {
          value: "positions",
          label: "Manage",
          count: 4,
          countLabel: "4 actions to take",
        },
      ]}
      value="earn"
      onValueChange={args.onValueChange}
      label="Sections"
    />
  ),
  play: async ({ canvasElement }) => {
    const tab = within(canvasElement).getByRole("tab", {
      name: "Manage 4 actions to take",
    });
    await expect(tab).toBeVisible();
    await expect(within(tab).getByText("4")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  },
};

/** Each tab is at least 40px tall, whichever the indicator. */
export const Height: Story = {
  play: async ({ canvasElement }) => {
    for (const tab of within(tabList(canvasElement)).getAllByRole("tab")) {
      await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        40
      );
    }
  },
};

const many: ReadonlyArray<TabOption<string>> = [
  { value: "defi", label: "DeFi" },
  { value: "stake", label: "Stake" },
  { value: "rwa", label: "RWA" },
  { value: "borrow", label: "Borrow" },
  { value: "manage", label: "Manage", count: 4, separated: true },
  { value: "activity", label: "Activity" },
];

/** Tabs too many for the row, as on a phone, the last one selected. */
const NarrowTabs = ({ selected }: { readonly selected: string }) => {
  const [value, setValue] = useState(selected);
  return (
    <ContainerFrame width={240}>
      <Tabs
        tabs={many}
        value={value}
        onValueChange={setValue}
        label="Sections"
      />
    </ContainerFrame>
  );
};

/**
 * Tabs that do not fit scroll across rather than being cut off: the end
 * that hides tabs fades out, and the selected tab scrolls into view clear
 * of the fade. The rule stays the row's full width as the tabs scroll.
 */
export const ScrollsAcross: Story = {
  render: () => <NarrowTabs selected="activity" />,
  play: async ({ canvasElement }) => {
    const list = tabList(canvasElement);
    const activity = within(list).getByRole("tab", { name: "Activity" });

    await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
    await expect(list.scrollLeft).toBeGreaterThan(0);
    const row = list.getBoundingClientRect();
    const tab = activity.getBoundingClientRect();
    await expect(tab.left).toBeGreaterThanOrEqual(row.left);
    await expect(tab.right).toBeLessThanOrEqual(row.right + 0.5);
    // Scrolled to its end, only the start hides tabs, and fades.
    await waitFor(() =>
      expect(getComputedStyle(list).maskImage).toMatch(/to right/)
    );
    await expect(getComputedStyle(list).maskImage).not.toMatch(/calc/);

    list.scrollLeft = 0;
    await waitFor(() =>
      expect(getComputedStyle(list).maskImage).toMatch(/to left/)
    );
    await expect(railOf(list).getBoundingClientRect().width).toBe(240);
  },
};

export const ScrollsAcrossPill: Story = {
  ...ScrollsAcross,
  globals: { tabsIndicator: "pill" },
};

/**
 * In a narrow row that scrolls its tabs across, each tab draws its focus
 * ring inside its edge, where the row would cut off one drawn outside, at
 * either end of the row.
 */
export const RingInsideScrollingBar: Story = {
  render: (args) => (
    <ContainerFrame width={140}>
      <Tabs
        tabs={grouped}
        value="earn"
        onValueChange={args.onValueChange}
        label="Sections"
      />
    </ContainerFrame>
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

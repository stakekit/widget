import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { iconLeadsInline } from "../storybook/geometry";
import { Button } from "./button";
import { Notice } from "./notice";

const meta = {
  title: "Components/Notice",
  component: Notice,
  args: {
    tone: "warning",
    children: "Unstaking takes up to 7 days. Rewards stop during that time.",
  },
} satisfies Meta<typeof Notice>;
export default meta;

type Story = StoryObj<typeof meta>;

const tones = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
] as const;

export const Body: Story = {};

/**
 * Without a title, the icon sits inline at the start of the first line, so
 * the wrapped lines start at the notice's own left edge, under the icon.
 */
export const BodyWraps: Story = {
  args: {
    tone: "neutral",
    children:
      "Liquidation can occur if LTV crosses the selected market threshold.",
    testId: "notice",
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Notice {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const icon = canvas.getByTestId("notice").querySelector("svg");
    const body = canvas.getByText(
      "Liquidation can occur if LTV crosses the selected market threshold."
    );

    await expect(icon && iconLeadsInline(body, icon)).toBe(true);
  },
};

export const WithTitle: Story = { args: { title: "Unstaking period" } };

/**
 * With a title, the icon sits on the title's line, and the body and action
 * start at the notice's own left edge rather than beside the icon.
 */
export const WithAction: Story = {
  args: {
    tone: "danger",
    title: "Action required",
    children: "Your position needs more collateral.",
    testId: "notice",
    action: (
      <Button size="sm" onClick={fn()}>
        Add collateral
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const icon = canvas
      .getByTestId("notice")
      .querySelector("svg")
      ?.getBoundingClientRect();
    const title = canvas.getByText("Action required").getBoundingClientRect();
    const body = canvas
      .getByText("Your position needs more collateral.")
      .getBoundingClientRect();
    const action = canvas
      .getByRole("button", { name: "Add collateral" })
      .getBoundingClientRect();

    // The icon shares the title's line.
    await expect(icon?.top).toBeLessThan(title.bottom);
    await expect(icon?.bottom).toBeGreaterThan(title.top);
    // Body and action line up with the icon, under it.
    await expect(Math.abs(body.left - (icon?.left ?? 0))).toBeLessThanOrEqual(
      1
    );
    await expect(Math.abs(action.left - body.left)).toBeLessThanOrEqual(1);
    await expect(body.top).toBeGreaterThanOrEqual(title.bottom);
  },
};

/** Every tone, with a title. */
export const Tones: Story = {
  render: (args) => (
    <Stack gap={8}>
      {tones.map((tone) => (
        <Notice key={tone} {...args} tone={tone} title={tone} />
      ))}
    </Stack>
  ),
};

export const TonesDark: Story = { ...Tones, globals: { colorScheme: "dark" } };

/** While busy, a spinner replaces the tone's icon. */
export const Busy: Story = {
  args: {
    tone: "neutral",
    title: "Checking verification",
    children: "This takes a few seconds.",
    busy: true,
    testId: "notice",
  },
  play: async ({ canvasElement }) => {
    const notice = within(canvasElement).getByTestId("notice");
    await expect(notice).toHaveAttribute("aria-busy", "true");
  },
};

/** Busy without a title: the spinner takes the icon's place, inline. */
export const BusyBodyWraps: Story = {
  args: {
    tone: "neutral",
    children: "Checking your verification. This takes a few seconds.",
    busy: true,
    testId: "notice",
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Notice {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notice = canvas.getByTestId("notice");
    const spinner = notice.querySelector('[aria-hidden="true"]');
    const body = canvas.getByText(
      "Checking your verification. This takes a few seconds."
    );

    await expect(notice).toHaveAttribute("aria-busy", "true");
    await expect(notice.querySelector("svg")).toBeNull();
    await expect(spinner && iconLeadsInline(body, spinner)).toBe(true);
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Badge } from "./badge";
import { Card } from "./card";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: { children: "Pending", tone: "warning" },
} satisfies Meta<typeof Badge>;
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

export const Soft: Story = { args: { variant: "soft" } };
export const Outline: Story = { args: { variant: "outline" } };
export const WithIcon: Story = {
  args: { tone: "success", icon: "PreferredIcon", children: "Preferred" },
};

/**
 * `collapse="belowSm"`: below the `sm` container size only the icon shows,
 * so a name beside it keeps its room; the label still names the badge.
 */
export const CollapseBelowSm: Story = {
  args: {
    tone: "accent",
    icon: "PreferredIcon",
    children: "Preferred",
    collapse: "belowSm",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Preferred")
    ).toBeInTheDocument();
  },
};

/** Every tone, soft and outlined. */
export const TonesAndVariants: Story = {
  render: () => (
    <Stack gap={8}>
      {(["soft", "outline"] as const).map((variant) => (
        <Stack key={variant} direction="row" gap={8} wrap>
          {tones.map((tone) => (
            <Badge key={tone} tone={tone} variant={variant}>
              {tone}
            </Badge>
          ))}
        </Stack>
      ))}
    </Stack>
  ),
};

export const TonesAndVariantsDark: Story = {
  ...TonesAndVariants,
  globals: { colorScheme: "dark" },
};

/**
 * On a row's surface, each soft badge is edged in its tone and keeps its
 * leading icon and label on one line inside its box.
 */
export const OnSurface: Story = {
  render: () => (
    <Card testId="surface">
      <Stack direction="row" gap={8} wrap>
        {tones.map((tone) => (
          <Badge key={tone} tone={tone} icon="WarningIcon" testId="badge">
            {tone}
          </Badge>
        ))}
      </Stack>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = canvas.getByTestId("surface");
    const surfaceBox = surface.getBoundingClientRect();
    const surfaceColor = getComputedStyle(surface).backgroundColor;

    for (const badge of canvas.getAllByTestId("badge")) {
      const box = badge.getBoundingClientRect();
      const icon = badge.querySelector("svg");
      const iconBox = icon?.getBoundingClientRect();

      // Drawn, and in a color of its own: not transparent, not the surface's.
      const edge = getComputedStyle(badge).borderTopColor;
      await expect(edge).not.toBe(surfaceColor);
      await expect(edge).not.toMatch(/, 0\)$/);
      await expect(badge.scrollWidth).toBeLessThanOrEqual(badge.clientWidth);
      await expect(box.left).toBeGreaterThanOrEqual(surfaceBox.left);
      await expect(box.right).toBeLessThanOrEqual(surfaceBox.right);
      await expect(iconBox?.top).toBeGreaterThanOrEqual(box.top);
      await expect(iconBox?.bottom).toBeLessThanOrEqual(box.bottom);
      // One line: the label sits beside the icon, not under it.
      await expect(box.height).toBeLessThan((iconBox?.height ?? 0) * 2);
    }
  },
};

export const OnSurfaceDark: Story = {
  ...OnSurface,
  globals: { colorScheme: "dark" },
};

/** As a `status`, the badge is announced when it appears or changes. */
export const Status: Story = {
  args: { role: "status", children: "Confirm in wallet" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent(
      "Confirm in wallet"
    );
  },
};

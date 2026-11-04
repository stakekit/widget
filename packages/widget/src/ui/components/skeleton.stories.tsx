import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Stack } from "../primitives/stack";
import { Card } from "./card";
import { Skeleton } from "./skeleton";

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  args: { shape: "line" },
} satisfies Meta<typeof Skeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Line: Story = { args: { shape: "line", role: "body" } };
export const Rect: Story = { args: { shape: "rect", height: "md" } };
/** `panel` stands in for an amount panel; `section` for a taller section. */
export const RectPanel: Story = { args: { shape: "rect", height: "panel" } };
export const RectSection: Story = {
  args: { shape: "rect", height: "section" },
};

/** `fill` takes its parent's height, such as a loading chart's. */
export const RectFill: Story = {
  args: { shape: "rect", height: "fill" },
  render: (args) => (
    <div style={{ height: 160 }}>
      <Skeleton {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector("[aria-hidden='true']");
    await expect(skeleton?.getBoundingClientRect().height).toBe(160);
  },
};

export const Circle: Story = { args: { shape: "circle", size: "lg" } };

/** Every skeleton shape, as a loading list row would use them. */
export const Skeletons: Story = {
  render: () => (
    <Stack gap={16} role="group" aria-busy="true" aria-label="Loading">
      <Card>
        <Stack direction="row" align="center" gap={12}>
          <Skeleton shape="circle" size="md" />
          <Stack gap={4} grow>
            <Skeleton shape="line" width="half" />
            <Skeleton shape="line" role="caption" width="quarter" />
          </Stack>
        </Stack>
      </Card>
      <Skeleton shape="line" width="threeQuarters" />
      <Skeleton shape="rect" height="sm" />
      <Skeleton shape="rect" height="md" width="half" />
      <Skeleton shape="rect" height="lg" />
    </Stack>
  ),
};

export const SkeletonsDark: Story = {
  ...Skeletons,
  globals: { colorScheme: "dark" },
};

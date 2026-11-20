import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Card } from "../components/card";
import { Box } from "./box";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
  title: "Primitives/Box",
  component: Box,
  args: { children: <Text>Box content</Text> },
  render: (args) => (
    <Card padding={0}>
      <Box {...args} />
    </Card>
  ),
} satisfies Meta<typeof Box>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Padding: Story = { args: { padding: 16 } };

/** `paddingBlock` and `paddingInline` win over `padding` on their axis. */
export const AxisPadding: Story = {
  args: { padding: 8, paddingInline: "gutter" },
};

export const SectionInset: Story = { args: { padding: "section" } };

export const Widths: Story = {
  render: () => (
    <Stack gap={8}>
      <Card padding={0}>
        <Box width="fit" padding={8}>
          <Text>fit</Text>
        </Box>
      </Card>
      <Card padding={0}>
        <Box width="full" maxWidth="sm" padding={8}>
          <Text>full, capped at the sm container size</Text>
        </Box>
      </Card>
    </Stack>
  ),
};

export const PositionAndOverflow: Story = {
  args: {
    position: "relative",
    overflow: "hidden",
    padding: 8,
    children: <Text truncate>A long line that the box cuts at its edge</Text>,
  },
};

/**
 * `testId` renders as `data-testid` and `hostHook` as `data-rk`, on Box, Stack
 * and Grid alike.
 */
export const TestIdAndHostHook: Story = {
  args: {
    padding: 8,
    testId: "box-test-id",
    hostHook: "estimated-reward__yearly",
  },
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByTestId("box-test-id");
    await expect(box).toHaveTextContent("Box content");
    await expect(box).toHaveAttribute("data-rk", "estimated-reward__yearly");
  },
};

/** `minHeight` holds a control's height with nothing in it yet. */
export const ReservedRow: Story = {
  args: { minHeight: "controlSm", testId: "reserved-row", children: null },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByTestId("reserved-row");
    await expect(row.getBoundingClientRect().height).toBe(32);
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Card } from "../components/card";
import { ContainerFrame, narrowAndWide } from "../storybook/container-frame";
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

/** 8px padding below the `md` container size, 24px from it up. */
export const Responsive: Story = {
  args: { padding: { base: 8, md: 24 }, role: "group", "aria-label": "Box" },
  render: (args) => (
    <Stack gap={8}>
      <ContainerFrame width={380}>
        <Box {...args} />
      </ContainerFrame>
      <ContainerFrame width={600}>
        <Box {...args} />
      </ContainerFrame>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const [narrow, wide] = narrowAndWide(
      within(canvasElement).getAllByRole("group", { name: "Box" })
    );
    await expect(getComputedStyle(narrow).paddingTop).toBe("8px");
    await expect(getComputedStyle(wide).paddingTop).toBe("24px");
  },
};

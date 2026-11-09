import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Card } from "../components/card";
import {
  ContainerFrame as Frame,
  narrowAndWide,
} from "../storybook/container-frame";
import { Stack } from "./stack";
import { Text } from "./text";

const items = ["Stake", "Unstake", "Claim"];

const meta = {
  title: "Primitives/Stack",
  component: Stack,
  args: {
    gap: 8,
    children: items.map((item) => (
      <Card key={item} padding={12}>
        <Text>{item}</Text>
      </Card>
    )),
  },
} satisfies Meta<typeof Stack>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Column: Story = {};

export const Row: Story = { args: { direction: "row", align: "center" } };

export const Between: Story = {
  args: { direction: "row", justify: "between" },
};

export const Wrap: Story = {
  args: {
    direction: "row",
    wrap: true,
    children: Array.from({ length: 12 }, (_, index) => (
      <Card key={index} padding={8}>
        <Text>{`Chip ${index + 1}`}</Text>
      </Card>
    )),
  },
};

/** A column below the `md` container size, a row from it up. */
export const Responsive: Story = {
  args: {
    direction: { base: "column", md: "row" },
    gap: { base: 8, md: 16 },
    role: "group",
    "aria-label": "Actions",
  },
  render: (args) => (
    <Stack gap={24}>
      <Stack as="section" aria-label="Narrow" gap={8}>
        <Text variant="label">380px wide</Text>
        <Frame width={380}>
          <Stack {...args} />
        </Frame>
      </Stack>
      <Stack as="section" aria-label="Wide" gap={8}>
        <Text variant="label">600px wide</Text>
        <Frame width={600}>
          <Stack {...args} />
        </Frame>
      </Stack>
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const [narrow, wide] = narrowAndWide(
      within(canvasElement).getAllByRole("group", { name: "Actions" })
    );
    await expect(getComputedStyle(narrow).flexDirection).toBe("column");
    await expect(getComputedStyle(wide).flexDirection).toBe("row");
  },
};

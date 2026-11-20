import type { Meta, StoryObj } from "@storybook/react-vite";

import { Card } from "../components/card";
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

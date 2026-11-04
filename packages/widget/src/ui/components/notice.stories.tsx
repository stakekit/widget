import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Stack } from "../primitives/stack";
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

export const WithTitle: Story = { args: { title: "Unstaking period" } };

export const WithAction: Story = {
  args: {
    tone: "danger",
    title: "Action required",
    children: "Your position needs more collateral.",
    action: (
      <Button size="sm" onClick={fn()}>
        Add collateral
      </Button>
    ),
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

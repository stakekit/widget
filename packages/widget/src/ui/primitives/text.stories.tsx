import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Text } from "./text";

const meta = {
  title: "Primitives/Text",
  component: Text,
  args: { children: "Stake ETH and earn rewards" },
} satisfies Meta<typeof Text>;
export default meta;

type Story = StoryObj<typeof meta>;

const column = { display: "grid", gap: 12 } as const;

export const Body: Story = {};

/** Every type role. Heading roles name their element. */
export const Roles: Story = {
  render: () => (
    <div style={column}>
      <Text variant="display" as="p">
        1,234.56
      </Text>
      <Text variant="title" as="h1">
        Title
      </Text>
      <Text variant="heading" as="h2">
        Heading
      </Text>
      <Text variant="metric">4.21%</Text>
      <Text variant="body">Body</Text>
      <Text variant="label">Label</Text>
      <Text variant="caption">Caption</Text>
      <Text variant="overline">Overline</Text>
    </div>
  ),
};

const informationTones = [
  "default",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
] as const;

/** Every tone that carries information, which keeps 4.5:1 contrast. */
export const Tones: Story = {
  render: () => (
    <div style={column}>
      {informationTones.map((tone) => (
        <Text key={tone} tone={tone}>
          {tone}
        </Text>
      ))}
    </div>
  ),
};

export const TonesDark: Story = { ...Tones, globals: { colorScheme: "dark" } };

/**
 * `subtle` is for disabled and decorative text only, so it sits below the
 * text contrast threshold by design.
 */
export const SubtleTone: Story = {
  args: { tone: "subtle", children: "Decorative" },
  parameters: {
    a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
  },
};

export const Weights: Story = {
  render: () => (
    <div style={column}>
      <Text weight="regular">Regular</Text>
      <Text weight="medium">Medium</Text>
      <Text weight="semibold">Semibold</Text>
    </div>
  ),
};

export const Numeric: Story = { args: { numeric: true, children: "0.0123" } };

export const Truncated: Story = {
  args: {
    truncate: true,
    children:
      "A long yield name that does not fit its container and ends in an ellipsis",
  },
  render: (args) => (
    <div style={{ width: 200 }}>
      <Text {...args} />
    </div>
  ),
};

/** Centered lines, such as a heading under a centered icon. */
export const Centered: Story = {
  args: { as: "p", align: "center" },
  render: (args) => (
    <div style={{ width: 200 }}>
      <Text {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector("p");
    await expect(text && getComputedStyle(text).textAlign).toBe("center");
  },
};

/** A long unbroken amount wraps inside its container instead of overflowing. */
export const BreakAnywhere: Story = {
  args: {
    as: "p",
    breakAnywhere: true,
    children: "0.123456789012345678901234 ETH",
  },
  render: (args) => (
    <div style={{ width: 120 }}>
      <Text {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector("p");
    await expect(text?.scrollWidth).toBeLessThanOrEqual(text?.clientWidth ?? 0);
  },
};

/** Emphasis inside translated copy, as `<Trans components>` renders it. */
export const StrongAndMark: Story = {
  render: () => (
    <Text as="p">
      Stake <Text.Mark>ETH</Text.Mark> and earn up to{" "}
      <Text.Strong>4.21%</Text.Strong> a year.
    </Text>
  ),
};

export const StrongAndMarkDark: Story = {
  ...StrongAndMark,
  globals: { colorScheme: "dark" },
};

/** A line break inside translated copy, where the translation has `<br0/>`. */
export const Break: Story = {
  render: () => (
    <Text as="p">
      Earn self-custodial yield.
      <Text.Break />
      Find more on our website.
    </Text>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("p br")).not.toBeNull();
  },
};

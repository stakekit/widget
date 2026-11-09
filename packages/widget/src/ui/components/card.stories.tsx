import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { Card } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
  args: {
    children: (
      <Stack gap={4}>
        <Text weight="semibold">Ethereum staking</Text>
        <Text tone="muted">Earn rewards on your ETH</Text>
      </Stack>
    ),
  },
} satisfies Meta<typeof Card>;
export default meta;

type Story = StoryObj<typeof meta>;

const variants = ["filled", "outline", "raised"] as const;
const tones = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
] as const;

/** A filled card where the Host Profile presents elevated surfaces. */
export const Elevated: Story = {
  args: { variant: "filled" },
  globals: { surfaceStyle: "elevated" },
};
/** A filled card where the Host Profile presents outlined surfaces. */
export const Outlined: Story = {
  args: { variant: "filled" },
  globals: { surfaceStyle: "outlined" },
};
/** A field card whose content cannot be used: a `danger` edge. */
export const Invalid: Story = {
  args: { variant: "field", invalid: true, testId: "card" },
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByTestId("card");
    await expect(getComputedStyle(card).borderTopStyle).toBe("solid");
  },
};
/** The danger edge in each surface style. */
export const InvalidOutlined: Story = {
  ...Invalid,
  globals: { surfaceStyle: "outlined" },
};

/** Every variant in every tone. */
export const VariantsAndTones: Story = {
  render: () => (
    <Stack gap={12}>
      {variants.map((variant) => (
        <Stack key={variant} direction="row" gap={8} wrap>
          {tones.map((tone) => (
            <Card key={tone} variant={variant} tone={tone} padding={12}>
              <Text>{`${variant} ${tone}`}</Text>
            </Card>
          ))}
        </Stack>
      ))}
    </Stack>
  ),
};

export const VariantsAndTonesDark: Story = {
  ...VariantsAndTones,
  globals: { colorScheme: "dark" },
};

export const Paddings: Story = {
  render: () => (
    <Stack gap={8}>
      <Card padding={8}>
        <Text>8</Text>
      </Card>
      <Card padding={16}>
        <Text>16</Text>
      </Card>
      <Card padding="section">
        <Text>section</Text>
      </Card>
      <Card padding={{ base: 8, md: 24 }}>
        <Text>8, 24 from the md container size up</Text>
      </Card>
    </Stack>
  ),
};

/** With `grow`, a card takes the space its row or column has left. */
export const Grow: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <Stack direction="row" gap={8}>
        <Card testId="fixed card" padding={12}>
          <Text>Fits its content</Text>
        </Card>
        <Card testId="grown card" padding={12} grow>
          <Text>Takes the rest</Text>
        </Card>
      </Stack>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const widthOf = (testId: string) =>
      canvas.getByTestId(testId).getBoundingClientRect().width;

    await expect(widthOf("grown card")).toBeGreaterThan(widthOf("fixed card"));
    await expect(widthOf("fixed card") + 8 + widthOf("grown card")).toBeCloseTo(
      480,
      0
    );
  },
};

/** With `onClick` the card is one button: Tab reaches it, Enter and Space press it. */
export const Interactive: Story = {
  args: { onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const card = within(canvasElement).getByRole("button", {
      name: /Ethereum staking/,
    });

    await userEvent.tab();
    await expect(card).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

/** Selection is a ring plus the accent tint, and reads as pressed. */
export const Selected: Story = {
  args: { onClick: fn(), selected: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /Ethereum staking/ })
    ).toHaveAttribute("aria-pressed", "true");
  },
};

export const SelectedDark: Story = {
  ...Selected,
  globals: { colorScheme: "dark" },
};

export const Disabled: Story = {
  args: { onClick: fn(), disabled: true },
  play: async ({ args, canvasElement }) => {
    const card = within(canvasElement).getByRole("button", {
      name: /Ethereum staking/,
    });
    await expect(card).toBeDisabled();
    await userEvent.click(card);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

/** With `href` the card is one link. */
export const Link: Story = {
  args: { href: "#ethereum" },
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(
      within(canvasElement).getByRole("link", { name: /Ethereum staking/ })
    ).toHaveFocus();
  },
};

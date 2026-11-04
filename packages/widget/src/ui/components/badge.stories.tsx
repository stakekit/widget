import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "../primitives/stack";
import { Badge } from "./badge";

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

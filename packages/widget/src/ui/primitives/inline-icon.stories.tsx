import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { iconLeadsInline } from "../storybook/geometry";
import { Icon } from "./icon";
import { InlineIcon } from "./inline-icon";
import { Text } from "./text";
import type { TypeRole } from "./type-role";

const meta = {
  title: "Primitives/InlineIcon",
  component: InlineIcon,
  args: {
    variant: "body",
    gap: 4,
    children: <Icon name="InfoIcon" size="sm" />,
  },
} satisfies Meta<typeof InlineIcon>;
export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The icon leads a `Text` of `variant`'s role: it sits centered on the first
 * line, and the wrapped lines start under it, at the text's left edge.
 */
const leadingText = (variant: TypeRole): Story => ({
  args: { variant },
  render: (args) => (
    <div style={{ width: 200 }}>
      <Text variant={variant} as="p">
        <InlineIcon {...args} />
        Withdrawals take up to seven days to arrive
      </Text>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector("p");
    const icon = text?.querySelector("svg");
    await expect(text && icon && iconLeadsInline(text, icon)).toBe(true);
  },
});

export const Display = leadingText("display");
export const Title = leadingText("title");
export const Heading = leadingText("heading");
export const Metric = leadingText("metric");
export const Body = leadingText("body");
export const Label = leadingText("label");
export const Caption = leadingText("caption");
export const Overline = leadingText("overline");

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

const typeRoles: ReadonlyArray<TypeRole> = [
  "display",
  "title",
  "heading",
  "metric",
  "body",
  "label",
  "caption",
  "overline",
];

/**
 * The icon leads a `Text` of each type role: it sits centered on the first
 * line, and the wrapped lines start under it, at the text's left edge.
 */
export const LeadsEveryTypeRole: Story = {
  render: (args) => (
    <div style={{ width: 200, display: "grid", gap: 16 }}>
      {typeRoles.map((variant) => (
        <Text key={variant} variant={variant} as="p">
          <InlineIcon {...args} variant={variant} />
          Withdrawals take up to seven days to arrive
        </Text>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const paragraphs = [...canvasElement.querySelectorAll("p")];
    const misaligned = typeRoles.filter((_, index) => {
      const text = paragraphs[index];
      const icon = text?.querySelector("svg");
      return !(text && icon && iconLeadsInline(text, icon));
    });
    await expect(paragraphs).toHaveLength(typeRoles.length);
    await expect(misaligned).toEqual([]);
  },
};

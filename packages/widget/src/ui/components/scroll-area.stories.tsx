import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Text } from "../primitives/text";
import { ScrollArea } from "./scroll-area";

const rows = Array.from({ length: 40 }, (_, index) => `Validator ${index + 1}`);

const meta = {
  title: "Components/ScrollArea",
  component: ScrollArea,
  args: {
    label: "Validators",
    maxHeight: "sm",
    children: (
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row) => (
          <Text key={row} as="p">
            {row}
          </Text>
        ))}
      </div>
    ),
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <ScrollArea {...args} />
    </div>
  ),
} satisfies Meta<typeof ScrollArea>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = { globals: { colorScheme: "dark" } };

/**
 * Tab reaches the named region, which overflows and so takes the browser's
 * own arrow and page keys. A story's dispatched keys do not scroll, so
 * `tests/ui/components/scroll-area.browser.test.tsx` presses them for real.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole("region", {
      name: "Validators",
    });

    await userEvent.tab();
    await expect(region).toHaveFocus();
    await expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
  },
};

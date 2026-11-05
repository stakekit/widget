import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { outlineUnclipped } from "../storybook/geometry";
import { Button } from "./button";
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

/**
 * While it overflows, the area keeps a gutter for its scrollbar, so content
 * reaching the end edge, such as right-aligned figures, never sits under it.
 */
export const ReservesScrollbarGutter: Story = {
  args: {
    children: (
      <div data-testid="content" style={{ display: "grid", gap: 8 }}>
        {rows.map((row) => (
          <Text key={row} as="p" align="end">
            {row}
          </Text>
        ))}
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Validators" });
    await userEvent.hover(region);
    const scrollbar = canvasElement.querySelector(
      "[data-orientation='vertical']"
    );
    if (!(scrollbar instanceof HTMLElement)) {
      throw new Error("Expected the vertical scrollbar");
    }
    const content = canvas.getByTestId("content").getBoundingClientRect();
    await expect(scrollbar.getBoundingClientRect().width).toBeGreaterThan(0);
    await expect(content.right).toBeLessThanOrEqual(
      scrollbar.getBoundingClientRect().left
    );
  },
};

/** Without overflow there is no scrollbar, so the content keeps the width. */
export const NoGutterWithoutOverflow: Story = {
  args: {
    children: (
      <div data-testid="content">
        <Text as="p">Validator 1</Text>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Validators" });
    await expect(
      canvas.getByTestId("content").getBoundingClientRect().width
    ).toBe(region.getBoundingClientRect().width);
  },
};

const longName = "Validator with a name far too long for one line of the area";

/**
 * A single line too long for the area, such as a transaction's type beside
 * its time, truncates: the area never scrolls sideways.
 */
export const TruncatesLongLines: Story = {
  args: {
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
          <div key={row} style={{ display: "flex", gap: 8 }}>
            <Text truncate>{`${row}: ${longName}`}</Text>
            <Text numeric>0.5 ETH</Text>
          </div>
        ))}
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Validators" });
    const line = canvas.getByText(`Validator 1: ${longName}`);
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
    await expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
    await expect(line.getBoundingClientRect().right).toBeLessThanOrEqual(
      region.getBoundingClientRect().right
    );
  },
};

const actions = Array.from({ length: 12 }, (_, index) => `Action ${index + 1}`);

/**
 * Tabbing down scrolls each control into view with room for its focus ring:
 * the one that lands at the area's bottom edge keeps its whole ring. Scroll
 * padding cannot move content at rest, so the content opens with a heading,
 * not a control flush with the top edge.
 */
export const KeepsRingAtEdge: Story = {
  args: {
    children: (
      <Stack gap={8} align="center">
        <Text as="p">Validators</Text>
        {actions.map((action) => (
          <Button key={action} variant="secondary">
            {action}
          </Button>
        ))}
      </Stack>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Validators" });
    const last = canvas.getByRole("button", { name: "Action 12" });

    await userEvent.tab();
    await expect(region).toHaveFocus();
    for (const action of actions) {
      await userEvent.tab();
      const button = canvas.getByRole("button", { name: action });
      await expect(button).toHaveFocus();
      await expect(outlineUnclipped(button)).toBe(true);
    }
    await expect(last).toHaveFocus();
  },
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { fadeDepths, outlineUnclipped } from "../storybook/geometry";
import { Button } from "./button";
import { Disclosure } from "./disclosure";
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
 * An edge that cuts content off fades it out, so the area reads as
 * scrolling: at rest only the bottom, part way down both edges, at the end
 * only the top. Keyboard focus on the area lifts the fades, so its ring shows
 * whole.
 */
export const FadesCutOffEdges: Story = {
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole("region", {
      name: "Validators",
    });
    await waitFor(() =>
      expect(fadeDepths(region)).toEqual({ top: 0, bottom: 24 })
    );

    region.scrollTop = 120;
    await waitFor(() =>
      expect(fadeDepths(region)).toEqual({ top: 24, bottom: 24 })
    );

    region.scrollTop = region.scrollHeight;
    await waitFor(() =>
      expect(fadeDepths(region)).toEqual({ top: 24, bottom: 0 })
    );

    await userEvent.tab();
    await expect(region).toHaveFocus();
    await expect(getComputedStyle(region).maskImage).toBe("none");
  },
};

/**
 * The area keeps a gutter for its scrollbar, so content reaching the end
 * edge, such as right-aligned figures, never sits under it.
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

/**
 * The gutter stays without overflow too, so content that grows past the
 * edge, such as a disclosure opening, neither narrows nor moves when the
 * scrollbar comes in, and does not widen when it goes.
 */
export const StableGutterAsContentGrows: Story = {
  args: {
    children: (
      <div data-testid="content">
        <Disclosure title="Active validators">
          <Stack gap={8}>
            {rows.map((row) => (
              <Text key={row} as="p">
                {row}
              </Text>
            ))}
          </Stack>
        </Disclosure>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Validators" });
    const content = canvas.getByTestId("content");
    const trigger = canvas.getByRole("button", { name: "Active validators" });
    const box = () => {
      const { left, width } = content.getBoundingClientRect();
      return { left, width };
    };
    const closed = box();
    await expect(closed.width).toBeLessThan(
      region.getBoundingClientRect().width
    );

    await userEvent.click(trigger);
    await waitFor(() =>
      expect(region.scrollHeight).toBeGreaterThan(region.clientHeight)
    );
    await expect(box()).toEqual(closed);

    await userEvent.click(trigger);
    await waitFor(() =>
      expect(region.scrollHeight).toBeLessThanOrEqual(region.clientHeight)
    );
    await expect(box()).toEqual(closed);
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

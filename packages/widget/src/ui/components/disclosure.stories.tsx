import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { outlineUnclipped } from "../storybook/geometry";
import { TokenAvatar } from "./avatar";
import { Badge } from "./badge";
import { Button } from "./button";
import { CopyButton } from "./copy-button";
import { Disclosure } from "./disclosure";
import { ScrollArea } from "./scroll-area";

const meta = {
  title: "Components/Disclosure",
  component: Disclosure,
  args: {
    title: "More details",
    children: <Text as="p">Rewards are paid every epoch.</Text>,
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <Disclosure {...args} />
    </div>
  ),
} satisfies Meta<typeof Disclosure>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultOpen: true } };

export const OpenDark: Story = {
  args: { defaultOpen: true },
  globals: { colorScheme: "dark" },
};

/** The trigger may lead with an avatar and carry badges after its title. */
export const WithLeadingAndBadges: Story = {
  args: {
    title: "Staked via Chorus One",
    leading: <TokenAvatar name="Chorus One" size="sm" decorative />,
    badges: <Badge tone="danger">Jailed</Badge>,
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: /Staked via Chorus One/,
    });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  },
};

export const WithLeadingAndBadgesDark: Story = {
  ...WithLeadingAndBadges,
  globals: { colorScheme: "dark" },
};

/**
 * Enter and Space toggle the content; the trigger's expanded state follows,
 * and focus stays on it.
 */
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "More details" });

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(canvas.getByText("Rewards are paid every epoch.")).toBeVisible()
    );

    await userEvent.keyboard(" ");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(canvas.queryByText("Rewards are paid every epoch.")).toBeNull()
    );
    await expect(trigger).toHaveFocus();
  },
};

/** The height of the panel holding the first line, once per frame for `ms`. */
const sampleHeights = async (canvasElement: HTMLElement, ms: number) => {
  const heights: number[] = [];
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const { promise, resolve } = Promise.withResolvers<number>();
    requestAnimationFrame(resolve);
    await promise;
    const panel = within(canvasElement)
      .queryByText("Rewards are paid every epoch.")
      ?.closest("[data-open], [data-closed]");
    heights.push(panel?.getBoundingClientRect().height ?? 0);
  }
  return heights;
};

/**
 * The content grows open from no height and shrinks closed, passing through
 * the heights between, rather than snapping.
 */
export const AnimatesHeight: Story = {
  args: {
    children: (
      <>
        <Text as="p">Rewards are paid every epoch.</Text>
        <Text as="p">Unstaking takes about a week.</Text>
        <Text as="p">Fees are taken from the rewards.</Text>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "More details",
    });
    const between = (heights: number[]) => {
      const full = Math.max(...heights);
      return heights.filter((height) => height > 1 && height < full - 1);
    };

    await userEvent.click(trigger);
    const opening = await sampleHeights(canvasElement, 400);
    await expect(Math.max(...opening)).toBeGreaterThan(40);
    await expect(between(opening).length).toBeGreaterThan(2);

    await userEvent.click(trigger);
    const closing = await sampleHeights(canvasElement, 400);
    await expect(between(closing).length).toBeGreaterThan(2);
  },
};

/**
 * In a scrolling area the trigger spans its width, so its focus ring draws
 * inside its edge, where the area would cut off one drawn outside.
 */
export const RingInsideScrollArea: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <div style={{ width: 320 }}>
      <ScrollArea label="Details" maxHeight="sm">
        <Disclosure {...args} />
      </ScrollArea>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "More details",
    });

    await userEvent.tab();
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(outlineUnclipped(trigger)).toBe(true);
  },
};

export const RingInsideScrollAreaDark: Story = {
  ...RingInsideScrollArea,
  globals: { colorScheme: "dark" },
};

/**
 * The panel clips its content to animate its height; a control at its side,
 * such as a copy button ending a row, still keeps its whole focus ring.
 */
export const PanelKeepsContentRings: Story = {
  args: {
    defaultOpen: true,
    children: (
      <Stack direction="row" align="center" justify="between">
        <Text as="p">0x52bc…e1f0</Text>
        <CopyButton value="0x52bc" label="Copy address" copiedLabel="Copied" />
      </Stack>
    ),
  },
  play: async ({ canvasElement }) => {
    const copy = within(canvasElement).getByRole("button", {
      name: "Copy address",
    });

    await userEvent.tab();
    await userEvent.tab();
    await expect(copy).toHaveFocus();
    await expect(outlineUnclipped(copy)).toBe(true);
  },
};

/**
 * A closed section at the end of a scrolling list, inside a frame that clips
 * what overflows it, and a control asking to show the section.
 */
const RevealFromElsewhere = () => {
  const [revealKey, setRevealKey] = useState(0);
  return (
    <Stack gap={8}>
      <Button size="sm" onClick={() => setRevealKey((key) => key + 1)}>
        Show details
      </Button>
      <div
        data-testid="frame"
        style={{ width: 320, height: 260, overflow: "hidden" }}
      >
        <ScrollArea label="Facts" maxHeight="sm">
          <Stack gap={8}>
            {Array.from({ length: 12 }, (_, index) => (
              <Text key={index} as="p">
                Fact {index + 1}
              </Text>
            ))}
            <Disclosure title="More details" revealKey={revealKey}>
              <Text as="p">Rewards are paid every epoch.</Text>
            </Disclosure>
          </Stack>
        </ScrollArea>
        <div style={{ height: 400 }} />
      </div>
    </Stack>
  );
};

/**
 * Asked from elsewhere, a closed section opens, scrolls its list to it and
 * takes focus, so the content it shows is where the user lands. The frame
 * clipping the list never moves, even when the list can't scroll the section
 * all the way to its top.
 */
export const Reveal: Story = {
  render: () => <RevealFromElsewhere />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "More details" });
    const list = canvas.getByRole("region", { name: "Facts" });

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Show details" }));

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveFocus();
    await waitFor(() =>
      expect(canvas.getByText("Rewards are paid every epoch.")).toBeVisible()
    );
    await waitFor(() => expect(list.scrollTop).toBeGreaterThan(0));
    // Long enough for a smooth scroll to settle.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await expect(canvas.getByTestId("frame").scrollTop).toBe(0);
  },
};

/**
 * Mounted with a reveal already asked, as when its section renders after
 * the request, the section starts open, focused.
 */
export const RevealedOnMount: Story = {
  args: { revealKey: 1 },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "More details",
    });

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveFocus();
  },
};

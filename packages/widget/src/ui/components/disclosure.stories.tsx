import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Text } from "../primitives/text";
import { TokenAvatar } from "./avatar";
import { Badge } from "./badge";
import { Disclosure } from "./disclosure";

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
